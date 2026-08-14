import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { Request, Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles';
import { UserRole } from '@prisma/client';
import { CreateFeedMediaDto, CreateUrlMediaDto, ImportInboxMediaDto, UpdateMediaDto } from './dto';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private media: MediaService) {}
  @Get('stream/:id') async stream(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const f = await this.media.getFile(id); const range = req.headers.range;
    res.setHeader('Accept-Ranges', 'bytes'); res.setHeader('Content-Type', f.media.mimeType ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    if (!range) { res.setHeader('Content-Length', f.size); return f.stream().pipe(res); }
    const [a, b] = range.replace(/bytes=/, '').split('-'); const start = Number(a); const end = b ? Number(b) : f.size - 1;
    if (start >= f.size || end >= f.size) return res.status(416).setHeader('Content-Range', `bytes */${f.size}`).end();
    res.status(206); res.setHeader('Content-Range', `bytes ${start}-${end}/${f.size}`); res.setHeader('Content-Length', end - start + 1);
    return createReadStream(f.path, { start, end }).pipe(res);
  }
  @Get('thumbnail/:name') @Header('Cache-Control', 'public, max-age=86400') thumbnail(@Param('name') name: string, @Res() res: Response) {
    const safe = name.replace(/[^a-zA-Z0-9._-]/g, ''); const path = join(this.media.dir, 'thumbs', safe);
    if (!existsSync(path)) return res.status(404).end();
    res.type('image/webp'); return createReadStream(path).pipe(res);
  }
  @Get('feed/:id') feed(@Param('id') id: string) { return this.media.getFeed(id); }
  @Get('inbox') @UseGuards(JwtAuthGuard, RolesGuard) inbox() { return this.media.listInbox(); }
  @Get() @UseGuards(JwtAuthGuard, RolesGuard) list() { return this.media.list(); }
  @Post('upload') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @UseInterceptors(FileInterceptor('file', { storage: diskStorage({ destination: process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'), filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`) }), limits: { fileSize: 2 * 1024 * 1024 * 1024 } }))
  upload(@UploadedFile() file: Express.Multer.File, @Query('name') name?: string) { return this.media.createFile(file, name); }
  @Post('url') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN, UserRole.EDITOR) createUrl(@Body() dto: CreateUrlMediaDto) { return this.media.createUrl(dto); }
  @Post('feed') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN, UserRole.EDITOR) createFeed(@Body() dto: CreateFeedMediaDto) { return this.media.createFeed(dto); }
  @Post('inbox/import') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN, UserRole.EDITOR) importInbox(@Body() dto: ImportInboxMediaDto) { return this.media.importInbox(dto.fileName, dto.name); }
  @Patch(':id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN, UserRole.EDITOR) update(@Param('id') id: string, @Body() dto: UpdateMediaDto) { return this.media.update(id, dto); }
  @Delete(':id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN, UserRole.EDITOR) remove(@Param('id') id: string) { return this.media.remove(id); }
}
