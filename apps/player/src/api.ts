function runtimeUrl(configured: string, fallbackPort: number, suffix = '') {
  const fallback = `${location.protocol}//${location.hostname}:${fallbackPort}${suffix}`;
  if (!configured) return fallback;
  try {
    const raw = configured.trim();
    const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `${location.protocol}//${raw.replace(/^\/+/, '')}`;
    const url = new URL(withProtocol);
    if (['localhost', '127.0.0.1'].includes(url.hostname) && !['localhost', '127.0.0.1'].includes(location.hostname)) {
      url.hostname = location.hostname;
    }
    if (suffix && (!url.pathname || url.pathname === '/')) url.pathname = suffix;
    return url.toString().replace(/\/$/, '');
  } catch { return fallback; }
}

const runtimeParameters = new URLSearchParams(location.search);
const runtimeApiUrl = runtimeParameters.get('apiUrl')?.trim() ?? '';
const runtimeSocketUrl = runtimeParameters.get('socketUrl')?.trim() ?? '';
const configuredApiUrl = runtimeApiUrl || import.meta.env.VITE_API_URL || '';

function socketUrlFromApi(apiUrl: string) {
  try {
    const url = new URL(apiUrl);
    url.pathname = url.pathname.replace(/\/api\/?$/, '') || '/';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch { return ''; }
}

export const API_URL = runtimeUrl(configuredApiUrl, 3000, '/api');
export const SOCKET_URL = runtimeUrl(
  runtimeSocketUrl || (runtimeApiUrl ? socketUrlFromApi(API_URL) : import.meta.env.VITE_SOCKET_URL ?? ''),
  3000,
);
export type QueueItem={id:string;mediaId:string;name:string;type:'IMAGE'|'VIDEO'|'PDF'|'URL'|'FEED'|'WIDGET';durationSec:number;useMediaDuration?:boolean;mediaDurationSec?:number;url:string;checksum?:string;mimeType?:string;position:number};
export type Queue={version:string;playlist:{id:string;name:string;loop:boolean;forced?:boolean}|null;items:QueueItem[];generatedAt:string};

export function clearDeviceAuth() {
  localStorage.removeItem('deviceToken');
  localStorage.removeItem('deviceId');
}

export async function playerFetch<T>(path:string,options:RequestInit={}){
  const token=localStorage.getItem('deviceToken'); const headers=new Headers(options.headers);
  if(token) headers.set('X-Device-Token',token);
  if(options.body) headers.set('Content-Type','application/json');
  let response:Response;try{response=await fetch(`${API_URL}${path}`,{...options,headers})}catch{throw new Error(`API_INDISPONIVEL: ${API_URL}`)}
  if(response.status===401){ clearDeviceAuth(); throw new Error('DEVICE_UNAUTHORIZED'); }
  if(!response.ok) throw new Error(`API ${response.status}`);
  return response.json() as Promise<T>;
}
