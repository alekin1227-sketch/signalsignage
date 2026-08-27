import type { Queue, QueueItem } from './api';

const CACHE = 'signage-media-v4';
const LEGACY_CACHES = ['signage-media-v2', 'signage-media-v3'];
const QUEUE_KEY = 'lastQueue';
const DB_NAME = 'signage-offline';
const DB_STORE = 'media';
const MAX_CACHE_BYTES = Math.max(256, Number(import.meta.env.VITE_PLAYER_CACHE_MAX_MB) || 2048) * 1024 * 1024;
const MIN_FREE_BYTES = 256 * 1024 * 1024;
let warming = false;
let pendingQueue: Queue | null = null;
let currentQueue: Queue | null = null;
let databasePromise: Promise<IDBDatabase | null> | null = null;
const pendingDownloads = new Map<string, Promise<Blob>>();

function cacheStorage(): CacheStorage | null {
  return typeof window !== 'undefined' && typeof window.caches !== 'undefined' ? window.caches : null;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise(resolve => {
    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') return resolve(null);
    try {
      const request = window.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(DB_STORE)) database.createObjectStore(DB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return databasePromise;
}

async function databaseGet(key: string): Promise<Blob | null> {
  const database = await openDatabase();
  if (!database) return null;
  return new Promise(resolve => {
    try {
      const request = database.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function databasePut(key: string, blob: Blob): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  await new Promise<void>((resolve, reject) => {
    try {
      const transaction = database.transaction(DB_STORE, 'readwrite');
      transaction.objectStore(DB_STORE).put(blob, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    } catch (error) { reject(error); }
  });
}

async function databaseKeys(): Promise<string[]> {
  const database = await openDatabase();
  if (!database) return [];
  return new Promise(resolve => {
    try {
      const request = database.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).getAllKeys();
      request.onsuccess = () => resolve(request.result.map(String));
      request.onerror = () => resolve([]);
    } catch { resolve([]); }
  });
}

async function databaseDelete(key: string): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  await new Promise<void>(resolve => {
    try {
      const transaction = database.transaction(DB_STORE, 'readwrite');
      transaction.objectStore(DB_STORE).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch { resolve(); }
  });
}

function mediaKey(item: QueueItem) {
  const version = item.checksum?.trim() || item.mediaId;
  try {
    const url = new URL(item.url, location.href);
    url.searchParams.set('__signage_cache', version);
    return url.toString();
  } catch { return `${item.url}::${version}`; }
}

function retainedKeys(queue: Queue | null) {
  return new Set((queue?.items ?? [])
    .filter(item => !['URL', 'FEED', 'WIDGET'].includes(item.type) && item.url)
    .map(mediaKey));
}

async function pruneToQueue(queue: Queue | null) {
  const retained = retainedKeys(queue);
  const storage = cacheStorage();
  if (storage) {
    try {
      const cache = await storage.open(CACHE);
      const requests = await cache.keys();
      await Promise.all(requests.filter(request => !retained.has(request.url)).map(request => cache.delete(request)));
    } catch {}
  }
  const keys = await databaseKeys();
  await Promise.all(keys.filter(key => !retained.has(key)).map(databaseDelete));
}

async function hasCapacity(blobSize: number) {
  try {
    const estimate = await navigator.storage?.estimate?.();
    const usage = Number(estimate?.usage ?? 0);
    const quota = Number(estimate?.quota ?? 0);
    const safeLimit = quota ? Math.min(MAX_CACHE_BYTES, Math.floor(quota * .65)) : MAX_CACHE_BYTES;
    return usage + blobSize <= safeLimit && (!quota || quota - usage - blobSize >= Math.min(MIN_FREE_BYTES, quota * .12));
  } catch { return true; }
}

async function storedBlob(key: string): Promise<Blob | null> {
  const storage = cacheStorage();
  if (storage) {
    try {
      const response = await storage.match(key);
      if (response) return response.blob();
    } catch {}
  }
  return databaseGet(key);
}

async function persistBlob(key: string, blob: Blob) {
  const storage = cacheStorage();
  if (storage) {
    try {
      const cache = await storage.open(CACHE);
      await cache.put(key, new Response(blob, { headers: { 'Content-Type': blob.type || 'application/octet-stream' } }));
      return true;
    } catch {}
  }
  try { await databasePut(key, blob); return true; }
  catch { return false; }
}

async function storeBlob(key: string, blob: Blob) {
  if (!(await hasCapacity(blob.size))) await pruneToQueue(currentQueue);
  if (!(await hasCapacity(blob.size))) return;
  if (await persistBlob(key, blob)) return;
  await pruneToQueue(currentQueue);
  await persistBlob(key, blob);
}

async function download(item: QueueItem): Promise<Blob> {
  const key = mediaKey(item);
  const saved = await storedBlob(key);
  if (saved) return saved;
  const active = pendingDownloads.get(key);
  if (active) return active;
  const task = (async () => {
    const response = await fetch(item.url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`MEDIA_${response.status}`);
    const blob = await response.blob();
    if (!blob.size) throw new Error('MEDIA_VAZIA');
    await storeBlob(key, blob);
    return blob;
  })();
  pendingDownloads.set(key, task);
  try { return await task; }
  finally { pendingDownloads.delete(key); }
}

async function warm(queue: Queue) {
  for (const item of queue.items) {
    if (['URL', 'FEED', 'WIDGET'].includes(item.type) || !item.url) continue;
    try { await download(item); } catch {}
  }
  if (currentQueue?.version === queue.version) await pruneToQueue(queue);
}

async function drainWarmQueue() {
  if (warming) return;
  warming = true;
  try {
    while (pendingQueue) {
      const current = pendingQueue;
      pendingQueue = null;
      await warm(current);
    }
  } catch {}
  finally { warming = false; }
}

export async function syncQueue(queue: Queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  currentQueue = queue;
  pendingQueue = queue;
  window.setTimeout(() => { void drainWarmQueue(); }, 250);
  try { await navigator.storage?.persist?.(); } catch {}
  const storage = cacheStorage();
  if (storage) for (const legacy of LEGACY_CACHES) storage.delete(legacy).catch(() => {});
  return queue;
}

export function offlineQueue(): Queue | null {
  try { const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? 'null'); currentQueue = queue; return queue; }
  catch { return null; }
}

export async function playableUrl(item: QueueItem) {
  if (['URL', 'FEED', 'WIDGET'].includes(item.type)) return item.url;
  return URL.createObjectURL(await download(item));
}
