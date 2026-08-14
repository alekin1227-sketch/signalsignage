import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MediaType } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { lookup } from 'dns/promises';
import { createReadStream, existsSync, mkdirSync, statSync } from 'fs';
import { copyFile, readdir, rename, stat, unlink } from 'fs/promises';
import { basename, extname, join, parse } from 'path';
const sharp = require('sharp') as typeof import('sharp').sharp;
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedMediaDto, CreateUrlMediaDto, UpdateMediaDto } from './dto';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly imageExtensions = new Set([
    '.png', '.jpg', '.jpeg', '.jfif', '.webp', '.gif', '.avif', '.bmp', '.ico',
    '.tif', '.tiff', '.svg', '.heic', '.heif',
  ]);
  private readonly videoExtensions = new Set([
    '.mp4', '.m4v', '.mov', '.mkv', '.avi', '.webm', '.wmv', '.mpeg', '.mpg',
    '.ts', '.mts', '.m2ts', '.3gp', '.ogv', '.flv',
  ]);
  private readonly documentExtensions = new Set(['.pdf']);
  readonly dir = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
  readonly inboxDir = process.env.MEDIA_INBOX_DIR ?? join(process.cwd(), 'media-inbox');
  private readonly feedCache = new Map<string, { expiresAt: number; value: unknown }>();
  constructor(private prisma: PrismaService) { mkdirSync(join(this.dir, 'thumbs'), { recursive: true }); mkdirSync(this.inboxDir, { recursive: true }); }

  list() { return this.prisma.media.findMany({ orderBy: { createdAt: 'desc' } }); }

  async listInbox() {
    const entries = await readdir(this.inboxDir, { withFileTypes: true });
    const supported = entries.filter(entry => entry.isFile() && (
      this.imageExtensions.has(extname(entry.name).toLowerCase())
      || this.videoExtensions.has(extname(entry.name).toLowerCase())
      || this.documentExtensions.has(extname(entry.name).toLowerCase())
    ));
    return Promise.all(supported.map(async entry => ({ fileName: entry.name, sizeBytes: (await stat(join(this.inboxDir, entry.name))).size })));
  }

  async importInbox(fileName: string, name?: string) {
    const safeName = basename(fileName);
    if (safeName !== fileName) throw new BadRequestException('Nome de arquivo inválido');
    const extension = extname(safeName).toLowerCase();
    const mimeType = this.videoExtensions.has(extension)
      ? 'video/*'
      : this.imageExtensions.has(extension)
        ? 'image/*'
        : this.documentExtensions.has(extension) ? 'application/pdf' : null;
    if (!mimeType) throw new BadRequestException('Formato não aceito. Use imagem, vídeo ou PDF');
    const source = join(this.inboxDir, safeName);
    const fileStat = await stat(source).catch(() => null);
    if (!fileStat?.isFile()) throw new NotFoundException('Arquivo não encontrado na pasta de entrada');
    if (fileStat.size > 2 * 1024 * 1024 * 1024) throw new BadRequestException('Arquivo maior que 2 GB');
    const targetName = `${randomUUID()}${extension}`; const target = join(this.dir, targetName);
    await copyFile(source, target);
    try {
      const media = await this.createFile({ path: target, filename: targetName, originalname: safeName, mimetype: mimeType, size: fileStat.size } as Express.Multer.File, name);
      await unlink(source).catch(() => undefined);
      return media;
    } catch (error) { await unlink(target).catch(() => undefined); throw error; }
  }

  private run(command: string, args: string[]) {
    return new Promise<string>((resolve, reject) => execFile(command, args, { maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(String(stderr || error.message).slice(-2000)));
      else resolve(String(stdout));
    }));
  }

  private async normalizeVideo(inputPath: string, fileName: string) {
    const temporaryName = `${parse(fileName).name}.processing.mp4`;
    const temporaryPath = join(this.dir, temporaryName);
    const outputName = `${parse(fileName).name}.mp4`;
    const outputPath = join(this.dir, outputName);
    const args = [
      '-y', '-i', inputPath, '-map', '0:v:0', '-map', '0:a?', '-sn', '-dn',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-tag:v', 'avc1',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
      '-movflags', '+faststart', temporaryPath,
    ];
    try {
      await this.run('ffmpeg', args);
      await unlink(inputPath).catch(() => undefined);
      await rename(temporaryPath, outputPath);
      return { path: outputPath, fileName: outputName };
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  private async normalizeImage(inputPath: string, fileName: string) {
    const temporaryName = `${parse(fileName).name}.processing.png`;
    const temporaryPath = join(this.dir, temporaryName);
    const outputName = `${parse(fileName).name}.png`;
    const outputPath = join(this.dir, outputName);
    try {
      await sharp(inputPath, { failOn: 'error', density: 144, limitInputPixels: 100_000_000 })
        .rotate().png({ compressionLevel: 8 }).toFile(temporaryPath);
      await unlink(inputPath).catch(() => undefined);
      await rename(temporaryPath, outputPath);
      return { path: outputPath, fileName: outputName };
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  private async preparePdf(inputPath: string, fileName: string) {
    await this.run('pdfinfo', [inputPath]);
    const outputName = `${parse(fileName).name}.pdf`;
    const outputPath = join(this.dir, outputName);
    const pagePrefix = join(this.dir, 'thumbs', `${outputName}.page`);
    const pagePng = `${pagePrefix}.png`;
    const thumbName = `${outputName}.webp`;
    const thumbPath = join(this.dir, 'thumbs', thumbName);
    try {
      await this.run('pdftoppm', ['-f', '1', '-singlefile', '-scale-to-x', '960', '-scale-to-y', '-1', '-png', inputPath, pagePrefix]);
      await sharp(pagePng).resize(480, 270, { fit: 'contain', background: '#ffffff' }).webp({ quality: 80 }).toFile(thumbPath);
      await unlink(pagePng).catch(() => undefined);
      if (inputPath !== outputPath) await rename(inputPath, outputPath);
      return { path: outputPath, fileName: outputName, thumbnailUrl: `/api/media/thumbnail/${thumbName}` };
    } catch (error) {
      await unlink(pagePng).catch(() => undefined);
      await unlink(thumbPath).catch(() => undefined);
      throw error;
    }
  }

  async createFile(file: Express.Multer.File, name?: string) {
    if (!file) throw new BadRequestException('Arquivo obrigatório');
    const extension = extname(file.originalname || file.filename).toLowerCase();
    const isPdf = this.documentExtensions.has(extension) || file.mimetype === 'application/pdf';
    const isImage = !isPdf && (this.imageExtensions.has(extension) || file.mimetype.startsWith('image/'));
    const isVideo = this.videoExtensions.has(extension) || file.mimetype.startsWith('video/');
    const type = isPdf ? MediaType.PDF : isImage ? MediaType.IMAGE : isVideo ? MediaType.VIDEO : null;
    if (!type) { await unlink(file.path).catch(() => undefined); throw new BadRequestException('Formato não aceito. Use imagem, vídeo ou PDF'); }
    let storedPath = file.path;
    let fileName = file.filename;
    let mimeType = file.mimetype;
    let thumbnailUrl: string | undefined;
    let thumbnailPath: string | undefined;
    let durationSec: number | undefined;
    try {
      if (type === MediaType.IMAGE) {
        try {
          const normalized = await this.normalizeImage(storedPath, fileName);
          storedPath = normalized.path; fileName = normalized.fileName; mimeType = 'image/png';
          const thumbName = `${fileName}.webp`;
          thumbnailPath = join(this.dir, 'thumbs', thumbName);
          try {
            await sharp(storedPath, { failOn: 'error' }).rotate().resize(480, 270, { fit: 'cover' }).webp({ quality: 78 }).toFile(thumbnailPath);
            thumbnailUrl = `/api/media/thumbnail/${thumbName}`;
          } catch (error) {
            await unlink(thumbnailPath).catch(() => undefined);
            thumbnailPath = undefined;
            this.logger.warn(`Thumbnail da imagem não gerada: ${(error as Error).message}`);
          }
        } catch (error) {
          const browserNative = new Set(['.png','.jpg','.jpeg','.jfif','.webp','.gif','.avif','.bmp','.ico','.svg']);
          if (!browserNative.has(extension)) throw error;
          this.logger.warn(`Imagem mantida no formato original: ${file.originalname}`);
          storedPath = file.path; fileName = file.filename;
          mimeType = file.mimetype.startsWith('image/') ? file.mimetype
            : ['.jpg','.jpeg','.jfif'].includes(extension) ? 'image/jpeg'
              : extension === '.svg' ? 'image/svg+xml' : `image/${extension.slice(1)}`;
        }
      } else if (type === MediaType.VIDEO) {
        const normalized = await this.normalizeVideo(storedPath, fileName);
        storedPath = normalized.path; fileName = normalized.fileName; mimeType = 'video/mp4';
        const thumbName = `${fileName}.webp`; const thumbPath = join(this.dir, 'thumbs', thumbName);
        thumbnailPath = thumbPath;
        await this.run('ffmpeg', ['-y','-ss','00:00:00.100','-i',storedPath,'-frames:v','1','-vf','scale=480:270:force_original_aspect_ratio=decrease',thumbPath]).catch(async error => { await unlink(thumbPath).catch(() => undefined); this.logger.warn(`Thumbnail não gerada: ${error.message}`); });
        if (existsSync(thumbPath) && statSync(thumbPath).size > 0) thumbnailUrl = `/api/media/thumbnail/${thumbName}`;
        const seconds = Number((await this.run('ffprobe', ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',storedPath])).trim());
        durationSec = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
      } else {
        const prepared = await this.preparePdf(storedPath, fileName);
        storedPath = prepared.path; fileName = prepared.fileName; mimeType = 'application/pdf'; thumbnailUrl = prepared.thumbnailUrl;
        thumbnailPath = join(this.dir, 'thumbs', `${fileName}.webp`);
      }
      const checksum = await new Promise<string>((resolve, reject) => { const hash = createHash('sha256'); createReadStream(storedPath).on('data', d => hash.update(d)).on('end', () => resolve(hash.digest('hex'))).on('error', reject); });
      const storedSize = statSync(storedPath).size;
      return await this.prisma.media.create({ data: {
        name: name || file.originalname, type, fileName, originalName: file.originalname,
        mimeType, sizeBytes: BigInt(storedSize), checksum, thumbnailUrl, durationSec,
      }});
    } catch (error) {
      this.logger.error(`Falha ao processar ${file.originalname}: ${(error as Error).message}`);
      await unlink(file.path).catch(() => undefined);
      if (storedPath !== file.path) await unlink(storedPath).catch(() => undefined);
      if (thumbnailPath) await unlink(thumbnailPath).catch(() => undefined);
      throw new BadRequestException(type === MediaType.IMAGE
        ? 'Não foi possível ler esta imagem. Tente PNG, JPG, WebP, GIF, AVIF, BMP, TIFF, SVG ou HEIC'
        : type === MediaType.PDF
          ? 'Não foi possível ler este PDF. Verifique se ele não está protegido por senha'
          : 'Não foi possível preparar o vídeo. Verifique se o arquivo possui uma faixa de vídeo válida');
    }
  }

  createUrl(dto: CreateUrlMediaDto) { return this.prisma.media.create({ data: { name: dto.name, type: MediaType.URL, url: dto.url, thumbnailUrl: dto.thumbnailUrl } }); }
  async createFeed(dto: CreateFeedMediaDto) {
    await this.assertSafeFeedUrl(dto.url);
    return this.prisma.media.create({ data: { name: dto.name, type: MediaType.FEED, url: dto.url, feedRefreshSec: dto.refreshSeconds ?? 300 } });
  }
  update(id: string, dto: UpdateMediaDto) { return this.prisma.media.update({ where: { id }, data: dto }); }
  async remove(id: string) {
    const current = await this.prisma.media.findUnique({
      where: { id },
      include: { playlistItems: { select: { playlistId: true } } },
    });
    if (!current) throw new NotFoundException('Mídia não encontrada');
    const playlistIds = [...new Set(current.playlistItems.map(item => item.playlistId))];
    const media = await this.prisma.$transaction(async tx => {
      await tx.playlistItem.deleteMany({ where: { mediaId: id } });
      for (const playlistId of playlistIds) {
        const remaining = await tx.playlistItem.findMany({
          where: { playlistId }, orderBy: { position: 'asc' }, select: { id: true },
        });
        for (let position = 0; position < remaining.length; position += 1) {
          await tx.playlistItem.update({ where: { id: remaining[position].id }, data: { position } });
        }
        await tx.playlist.update({ where: { id: playlistId }, data: { updatedAt: new Date() } });
      }
      return tx.media.delete({ where: { id } });
    });
    this.feedCache.delete(id);
    if (media.fileName) await unlink(join(this.dir, media.fileName)).catch(() => undefined);
    if (media.fileName) await unlink(join(this.dir, 'thumbs', `${media.fileName}.webp`)).catch(() => undefined);
    return { deleted: true, removedFromPlaylists: playlistIds.length };
  }

  async getFile(id: string) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media?.fileName) throw new NotFoundException('Mídia não encontrada');
    const path = join(this.dir, media.fileName);
    if (!existsSync(path)) throw new NotFoundException('Arquivo ausente');
    return { media, path, size: statSync(path).size, stream: () => createReadStream(path) };
  }

  private async assertSafeFeedUrl(rawUrl: string) {
    const resolved = rawUrl.replace('{{NEWS_API_KEY}}', encodeURIComponent(process.env.NEWS_API_KEY ?? ''));
    if (rawUrl.includes('{{NEWS_API_KEY}}') && !process.env.NEWS_API_KEY) throw new BadRequestException('NEWS_API_KEY não configurada no servidor');
    const url = new URL(resolved);
    if (!['http:', 'https:'].includes(url.protocol)) throw new BadRequestException('A fonte deve usar HTTP ou HTTPS');
    if (['localhost', '127.0.0.1', '::1'].includes(url.hostname)) throw new BadRequestException('Host local não permitido');
    const addresses = await lookup(url.hostname, { all: true });
    const blocked = addresses.some(({ address }) => /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address) || /^(::1|fc|fd|fe80)/i.test(address));
    if (blocked) throw new BadRequestException('A fonte não pode apontar para a rede interna');
    return url.toString();
  }

  private cleanText(value: unknown) {
    return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 800);
  }

  private async fetchPublicSource(initialUrl: string) {
    let url = initialUrl;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(12_000), headers: { Accept: 'application/json, application/rss+xml, application/atom+xml, text/xml;q=0.9', 'User-Agent': 'Somai-Signage/1.0' } });
      if (![301,302,303,307,308].includes(response.status)) return response;
      const location = response.headers.get('location');
      if (!location) throw new Error('A fonte redirecionou sem informar o destino');
      url = await this.assertSafeFeedUrl(new URL(location, url).toString());
    }
    throw new Error('A fonte excedeu o limite de redirecionamentos');
  }

  private normalizeArticles(payload: any) {
    let source: any[] = [];
    if (Array.isArray(payload)) source = payload;
    else if (Array.isArray(payload?.articles)) source = payload.articles;
    else if (Array.isArray(payload?.items)) source = payload.items;
    else if (Array.isArray(payload?.results)) source = payload.results;
    else if (Array.isArray(payload?.data)) source = payload.data;
    else if (payload?.rss?.channel?.item) source = Array.isArray(payload.rss.channel.item) ? payload.rss.channel.item : [payload.rss.channel.item];
    else if (payload?.feed?.entry) source = Array.isArray(payload.feed.entry) ? payload.feed.entry : [payload.feed.entry];
    return source.slice(0, 30).map((item: any, index) => {
      const link = typeof item.link === 'object' ? item.link?.['@_href'] : item.link;
      const image = item.urlToImage ?? item.image?.url ?? item.image ?? item.thumbnail?.url ?? item.enclosure?.['@_url'] ?? item['media:content']?.['@_url'];
      const sourceName = typeof item.source === 'object' ? item.source?.name : item.source;
      return {
        id: String(item.id ?? item.guid ?? link ?? index),
        title: this.cleanText(item.title ?? item.name ?? item.headline),
        description: this.cleanText(item.description ?? item.summary ?? item.content ?? item.contentSnippet),
        image: typeof image === 'string' ? image : undefined,
        link: typeof (item.url ?? link) === 'string' ? item.url ?? link : undefined,
        source: this.cleanText(sourceName),
        publishedAt: item.publishedAt ?? item.pubDate ?? item.published ?? item.date ?? null,
      };
    }).filter(article => article.title);
  }

  async getFeed(id: string) {
    const media = await this.prisma.media.findFirst({ where: { id, type: MediaType.FEED } });
    if (!media?.url) throw new NotFoundException('Fonte de notícias não encontrada');
    const cached = this.feedCache.get(id); if (cached && cached.expiresAt > Date.now()) return cached.value;
    const url = await this.assertSafeFeedUrl(media.url);
    let response: Response;
    try {
      response = await this.fetchPublicSource(url);
    } catch (error) {
      this.logger.error(`Falha ao consultar feed ${media.name} (${new URL(url).hostname}): ${(error as Error).message}`);
      if (cached) return cached.value;
      throw new BadGatewayException('Não foi possível consultar a fonte. Confira a URL, DNS, HTTPS e conexão do servidor');
    }
    if (!response.ok) throw new BadRequestException(`A fonte respondeu com HTTP ${response.status}`);
    const text = await response.text(); if (text.length > 2_000_000) throw new BadRequestException('Resposta da fonte maior que 2 MB');
    let payload: any;
    try { payload = text.trim().startsWith('<') ? new XMLParser({ ignoreAttributes: false }).parse(text) : JSON.parse(text); }
    catch { throw new BadRequestException('A fonte não retornou JSON ou RSS válido'); }
    const articles = this.normalizeArticles(payload);
    if (!articles.length) {
      throw new BadRequestException('Esta API não possui formato de notícias. Cadastre-a em Widgets de dados e mapeie os campos do JSON');
    }
    const value = { name: media.name, updatedAt: new Date(), refreshSeconds: media.feedRefreshSec ?? 300, articles };
    this.feedCache.set(id, { expiresAt: Date.now() + (media.feedRefreshSec ?? 300) * 1000, value });
    return value;
  }
}
