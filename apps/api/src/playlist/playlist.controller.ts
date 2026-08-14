import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles';
import { UserRole } from '@prisma/client';
import { CreatePlaylistDto, ReorderPlaylistDto } from './dto';
import { PlaylistService } from './playlist.service';

@UseGuards(JwtAuthGuard, RolesGuard) @Controller('playlists')
export class PlaylistController {
  constructor(private playlists: PlaylistService) {}
  @Get() list() { return this.playlists.list(); }
  @Get(':id') get(@Param('id') id: string) { return this.playlists.get(id); }
  @Post() @Roles(UserRole.ADMIN, UserRole.EDITOR) create(@Body() dto: CreatePlaylistDto) { return this.playlists.create(dto); }
  @Patch(':id/items') @Roles(UserRole.ADMIN, UserRole.EDITOR) reorder(@Param('id') id: string, @Body() dto: ReorderPlaylistDto) { return this.playlists.reorder(id, dto); }
  @Patch(':id') @Roles(UserRole.ADMIN, UserRole.EDITOR) update(@Param('id') id: string, @Body() dto: { name?: string; description?: string; isActive?: boolean; loop?: boolean }) { return this.playlists.update(id, dto); }
  @Delete(':id') @Roles(UserRole.ADMIN, UserRole.EDITOR) remove(@Param('id') id: string) { return this.playlists.remove(id); }
}
