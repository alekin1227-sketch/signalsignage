import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Integration, IntegrationAuthType, IntegrationStatus, Prisma } from '@prisma/client';
import { lookup } from 'dns/promises';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto';

@Injectable()
export class IntegrationService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.integration.findMany({ orderBy: [{ enabled: 'desc' }, { updatedAt: 'desc' }] });
  }

  async summary() {
    const [total, online, degraded, offline, untested] = await Promise.all([
      this.prisma.integration.count({ where: { enabled: true } }),
      this.prisma.integration.count({ where: { enabled: true, lastStatus: 'ONLINE' } }),
      this.prisma.integration.count({ where: { enabled: true, lastStatus: 'DEGRADED' } }),
      this.prisma.integration.count({ where: { enabled: true, lastStatus: 'OFFLINE' } }),
      this.prisma.integration.count({ where: { enabled: true, lastStatus: 'UNTESTED' } }),
    ]);
    return { total, online, degraded, offline, untested };
  }

  create(dto: CreateIntegrationDto) {
    this.validateAuth(dto.authType ?? 'NONE', dto.authHeaderName, dto.authEnvVar);
    const { metadata, ...data } = dto;
    return this.prisma.integration.create({ data: { ...data, authType: dto.authType ?? 'NONE', metadata: (metadata ?? {}) as Prisma.InputJsonValue, lastStatus: 'UNTESTED' } });
  }

  async update(id: string, dto: UpdateIntegrationDto) {
    const current = await this.find(id);
    const authType = dto.authType ?? current.authType;
    const authHeaderName = dto.authHeaderName ?? current.authHeaderName ?? undefined;
    const authEnvVar = dto.authEnvVar ?? current.authEnvVar ?? undefined;
    this.validateAuth(authType, authHeaderName, authEnvVar);
    const { metadata, ...data } = dto;
    return this.prisma.integration.update({
      where: { id },
      data: { ...data, ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}), lastStatus: this.connectionChanged(current, dto) ? 'UNTESTED' : undefined, lastMessage: this.connectionChanged(current, dto) ? null : undefined },
    });
  }

  async remove(id: string) {
    await this.find(id);
    await this.prisma.integration.delete({ where: { id } });
    return { deleted: true };
  }

  async test(id: string) {
    const integration = await this.find(id);
    const startedAt = Date.now();
    try {
      const result = integration.type === 'POWER_BI'
        ? await this.testPowerBi()
        : await this.testHttp(integration);
      const latencyMs = Date.now() - startedAt;
      return this.prisma.integration.update({
        where: { id }, data: { lastStatus: result.status, lastLatencyMs: latencyMs, lastTestAt: new Date(), lastMessage: result.message },
      });
    } catch (cause) {
      const latencyMs = Date.now() - startedAt;
      const message = cause instanceof Error ? cause.message : 'Falha desconhecida';
      return this.prisma.integration.update({
        where: { id }, data: { lastStatus: 'OFFLINE', lastLatencyMs: latencyMs, lastTestAt: new Date(), lastMessage: message.slice(0, 500) },
      });
    }
  }

  private async find(id: string) {
    const item = await this.prisma.integration.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Integração não encontrada');
    return item;
  }

  private connectionChanged(current: Integration, dto: UpdateIntegrationDto) {
    return ['type','baseUrl','authType','authHeaderName','authEnvVar'].some(key => (dto as any)[key] !== undefined && (dto as any)[key] !== (current as any)[key]);
  }

  private validateAuth(type: IntegrationAuthType, header?: string, env?: string) {
    if (type === 'NONE') return;
    if (!env) throw new BadRequestException('Informe a variável de ambiente que contém a credencial');
    if (type === 'API_KEY' && !header) throw new BadRequestException('Informe o nome do cabeçalho da API Key');
  }

  private privateAddress(address: string) {
    return /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address) || /^(::1|fc|fd|fe80)/i.test(address);
  }

  private async safeUrl(raw: string) {
    let url: URL;
    try { url = new URL(raw); } catch { throw new Error('URL inválida'); }
    if (!['http:','https:'].includes(url.protocol)) throw new Error('Somente HTTP e HTTPS são permitidos');
    const allowlist = (process.env.INTEGRATION_PRIVATE_HOST_ALLOWLIST ?? process.env.WIDGET_PRIVATE_HOST_ALLOWLIST ?? '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    const addresses = await lookup(url.hostname, { all: true }).catch(() => []);
    if (!addresses.length) throw new Error('Servidor não encontrado no DNS');
    if (!allowlist.includes(url.hostname.toLowerCase()) && addresses.some(item => this.privateAddress(item.address))) {
      throw new Error('Host interno não autorizado. Adicione-o em INTEGRATION_PRIVATE_HOST_ALLOWLIST');
    }
    return url.toString();
  }

  private authHeaders(item: Integration) {
    const headers: Record<string, string> = { Accept: 'application/json, text/plain, */*', 'User-Agent': 'Somai-Signage-Integration/1.0' };
    if (item.authType === 'NONE') return headers;
    const secret = item.authEnvVar ? process.env[item.authEnvVar] : undefined;
    if (!secret) throw new Error(`A variável ${item.authEnvVar ?? ''} não está configurada no servidor`);
    if (item.authType === 'BEARER') headers.Authorization = /^Bearer /i.test(secret) ? secret : `Bearer ${secret}`;
    if (item.authType === 'API_KEY') headers[item.authHeaderName || 'X-API-Key'] = secret;
    if (item.authType === 'BASIC') headers.Authorization = `Basic ${Buffer.from(secret).toString('base64')}`;
    return headers;
  }

  private async testHttp(item: Integration): Promise<{ status: IntegrationStatus; message: string }> {
    const url = await this.safeUrl(item.baseUrl);
    const response = await fetch(url, { method: 'GET', headers: this.authHeaders(item), redirect: 'manual', signal: AbortSignal.timeout(12_000) });
    await response.body?.cancel().catch(() => undefined);
    if (response.ok) return { status: 'ONLINE', message: `Conexão validada com HTTP ${response.status}` };
    if (response.status < 500) return { status: 'DEGRADED', message: `Servidor respondeu HTTP ${response.status}; revise autenticação ou rota` };
    throw new Error(`Servidor respondeu HTTP ${response.status}`);
  }

  private async testPowerBi(): Promise<{ status: IntegrationStatus; message: string }> {
    const tenant = process.env.POWERBI_TENANT_ID;
    const clientId = process.env.POWERBI_CLIENT_ID;
    const clientSecret = process.env.POWERBI_CLIENT_SECRET;
    if (!tenant || !clientId || !clientSecret) throw new Error('Credenciais POWERBI_TENANT_ID, POWERBI_CLIENT_ID e POWERBI_CLIENT_SECRET incompletas');
    const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope: 'https://analysis.windows.net/powerbi/api/.default' });
    const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(15_000) });
    const payload = await response.json().catch(() => ({})) as any;
    if (!response.ok || !payload.access_token) throw new Error(payload.error_description || 'A Microsoft recusou as credenciais');
    return { status: 'ONLINE', message: 'Microsoft Entra ID e Power BI autenticados com sucesso' };
  }
}
