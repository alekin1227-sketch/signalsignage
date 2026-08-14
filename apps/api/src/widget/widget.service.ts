import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MediaType } from '@prisma/client';
import { lookup } from 'dns/promises';
import { XMLParser } from 'fast-xml-parser';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyzeWidgetDto, UpdateWidgetDto, WidgetConfigDto } from './dto';

type WidgetView = {
  id?: string;
  name: string;
  template: string;
  refreshSeconds: number;
  updatedAt: string;
  stale?: boolean;
  style: Record<string, string>;
  data: unknown;
};

type DashboardSettings = {
  modules: string[];
  city: string;
  marketRegion: 'BRASIL' | 'CRIPTO' | 'CAMBIO' | 'TODOS';
  marketMode: 'RELEVANT' | 'GAINERS' | 'LOSERS' | 'VOLUME' | 'RANDOM' | 'CUSTOM';
  assetCount: number;
  customSymbols: string[];
  tickerEnabled: boolean;
  tickerSpeed: 'SLOW' | 'NORMAL' | 'FAST';
  newsRotationSeconds: number;
  marketRotationSeconds: number;
  newsEndpoint: string;
};

@Injectable()
export class WidgetService {
  private readonly cache = new Map<string, { expiresAt: number; value: WidgetView }>();

  constructor(private readonly prisma: PrismaService, private readonly media: MediaService) {}

  private dashboardSettings(mapping: unknown): DashboardSettings {
    const input = mapping && typeof mapping === 'object' ? mapping as Record<string, any> : {};
    const allowedModules = ['NEWS', 'WEATHER', 'MARKET', 'DATETIME'];
    const modules = Array.isArray(input.modules)
      ? [...new Set(input.modules.filter((item: unknown) => typeof item === 'string' && allowedModules.includes(item)))] as string[]
      : allowedModules;
    const region = ['BRASIL', 'CRIPTO', 'CAMBIO', 'TODOS'].includes(input.marketRegion) ? input.marketRegion : 'TODOS';
    const mode = ['RELEVANT', 'GAINERS', 'LOSERS', 'VOLUME', 'RANDOM', 'CUSTOM'].includes(input.marketMode) ? input.marketMode : 'RELEVANT';
    const symbols = Array.isArray(input.customSymbols) ? input.customSymbols : String(input.customSymbols ?? '').split(',');
    return {
      modules: modules.length ? modules : ['DATETIME'], city: this.text(input.city, 'Montes Claros - MG').slice(0, 120),
      marketRegion: region, marketMode: mode, assetCount: Math.min(30, Math.max(3, Number(input.assetCount) || 15)),
      customSymbols: symbols.map((item: unknown) => String(item).trim().toUpperCase()).filter(Boolean).slice(0, 30),
      tickerEnabled: input.tickerEnabled !== false, tickerSpeed: ['SLOW', 'NORMAL', 'FAST'].includes(input.tickerSpeed) ? input.tickerSpeed : 'NORMAL',
      newsRotationSeconds: Math.min(60, Math.max(5, Number(input.newsRotationSeconds) || 10)),
      marketRotationSeconds: Math.min(60, Math.max(5, Number(input.marketRotationSeconds) || 10)),
      newsEndpoint: this.text(input.newsEndpoint, 'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml'),
    } as DashboardSettings;
  }

  private async externalJson(url: string, headers: Record<string, string> = {}) {
    const safe = await this.safeUrl(url);
    const response = await fetch(safe, { headers: { Accept: 'application/json', 'User-Agent': 'Somai-Signage/1.0', ...headers }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > 2_000_000) throw new Error('Resposta maior que 2 MB');
    return JSON.parse(text);
  }

  private brapiHeaders(): Record<string, string> {
    const token = process.env.WIDGET_SECRET_BRAPI || process.env.BRAPI_API_TOKEN;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async dashboardNews(settings: DashboardSettings) {
    const payload = await this.request({ name: 'Notícias', endpoint: settings.newsEndpoint } as AnalyzeWidgetDto);
    const source = this.arraySource(payload);
    return (source?.items ?? []).slice(0, 20).map((item: any) => ({
      title: this.text(item.title ?? item.headline ?? item.titulo), description: this.text(item.description ?? item.summary ?? item.resumo),
      image: item.image ?? item.urlToImage ?? item.thumbnail, source: this.text(item.source?.name ?? item.source ?? 'Agência Brasil'),
      publishedAt: item.publishedAt ?? item.pubDate ?? item.date, link: item.link ?? item.url,
    })).filter((item: any) => item.title);
  }

  private async dashboardWeather(settings: DashboardSettings) {
    const states: Record<string, string> = {
      AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',
      GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',
      PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',
      SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins',
    };
    const normalize = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const rawCity = settings.city.trim();
    const parts = rawCity.split(/\s*(?:-|,|\/)\s*/).filter(Boolean);
    const stateCode = parts.length > 1 && /^[A-Za-z]{2}$/.test(parts.at(-1)!) ? parts.at(-1)!.toUpperCase() : '';
    const cityName = stateCode ? parts.slice(0, -1).join(' - ') : rawCity;
    const query = new URLSearchParams({ name: cityName, count: '10', language: 'pt', format: 'json', countryCode: 'BR' });
    const places = await this.externalJson(`https://geocoding-api.open-meteo.com/v1/search?${query}`);
    const expectedState = normalize(states[stateCode]);
    const place = expectedState
      ? places?.results?.find((item: any) => normalize(item.admin1) === expectedState) ?? places?.results?.[0]
      : places?.results?.[0];
    if (!place) throw new Error('Cidade não encontrada');
    const weatherQuery = new URLSearchParams({
      latitude: String(place.latitude), longitude: String(place.longitude), timezone: place.timezone || 'America/Sao_Paulo', forecast_days: '5',
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    });
    const payload = await this.externalJson(`https://api.open-meteo.com/v1/forecast?${weatherQuery}`);
    return {
      location: `${place.name}${place.admin1 ? ` - ${place.admin1}` : ''}`, temperature: payload.current?.temperature_2m,
      feelsLike: payload.current?.apparent_temperature, humidity: payload.current?.relative_humidity_2m,
      wind: payload.current?.wind_speed_10m, condition: payload.current?.weather_code,
      max: payload.daily?.temperature_2m_max?.[0], min: payload.daily?.temperature_2m_min?.[0], rain: payload.daily?.precipitation_probability_max?.[0],
    };
  }

  private normalizeStock(item: any) {
    const value = item?.data ?? item;
    return { symbol: item?.symbol ?? value?.symbol, name: value?.shortName ?? value?.longName, price: value?.regularMarketPrice, change: value?.regularMarketChangePercent, volume: value?.regularMarketVolume, currency: value?.currency ?? 'BRL', logo: value?.logourl };
  }

  private async dashboardMarket(settings: DashboardSettings) {
    const headers = this.brapiHeaders();
    const tokenAvailable = Boolean(headers.Authorization);
    let stockSymbols = settings.marketMode === 'CUSTOM' && settings.customSymbols.length
      ? settings.customSymbols
      : ['PETR4', 'VALE3', 'ITUB4', 'MGLU3'];
    if (tokenAvailable && settings.marketMode !== 'CUSTOM') {
      try {
        const available = await this.externalJson('https://brapi.dev/api/v2/tickers?limit=40', headers);
        const rows = available?.stocks ?? available?.tickers ?? available?.results ?? [];
        const discovered = rows.map((item: any) => item.stock ?? item.symbol ?? item.ticker).filter(Boolean);
        if (discovered.length) stockSymbols = discovered.slice(0, 30);
      } catch { /* mantém a seleção gratuita e conhecida */ }
    }
    const tasks: Promise<any[]>[] = [];
    if (['BRASIL', 'TODOS'].includes(settings.marketRegion)) tasks.push(
      this.externalJson(`https://brapi.dev/api/v2/stocks/quote?symbols=${encodeURIComponent(stockSymbols.join(','))}`, headers)
        .then(payload => (payload.results ?? []).map((item: any) => this.normalizeStock(item))).catch(() => []),
    );
    if (['CRIPTO', 'TODOS'].includes(settings.marketRegion)) tasks.push(
      this.externalJson('https://brapi.dev/api/v2/crypto?coin=BTC,ETH&currency=BRL', headers)
        .then(payload => (payload.coins ?? []).map((item: any) => ({ symbol: item.coin, name: item.coinName, price: item.regularMarketPrice, change: item.regularMarketChangePercent, volume: item.regularMarketVolume, currency: item.currency, logo: item.coinImageUrl }))).catch(() => []),
    );
    if (['CAMBIO', 'TODOS'].includes(settings.marketRegion)) tasks.push(
      this.externalJson('https://brapi.dev/api/v2/currency?currency=USD-BRL,EUR-BRL', headers)
        .then(payload => (payload.currency ?? []).map((item: any) => ({ symbol: `${item.fromCurrency}/${item.toCurrency}`, name: item.name, price: item.bidPrice, change: item.percentageChange, volume: 0, currency: item.toCurrency }))).catch(() => []),
    );
    let items = (await Promise.all(tasks)).flat().filter(item => item.symbol && Number.isFinite(Number(item.price)));
    if (settings.marketMode === 'GAINERS') items.sort((a, b) => Number(b.change) - Number(a.change));
    if (settings.marketMode === 'LOSERS') items.sort((a, b) => Number(a.change) - Number(b.change));
    if (settings.marketMode === 'VOLUME') items.sort((a, b) => Number(b.volume) - Number(a.volume));
    if (settings.marketMode === 'RANDOM') items = items.sort(() => Math.random() - .5);
    return items.slice(0, settings.assetCount);
  }

  private async dashboardPayload(config: WidgetConfigDto | UpdateWidgetDto) {
    const settings = this.dashboardSettings(config.mapping);
    const errors: Record<string, string> = {};
    const result: Record<string, any> = { settings, news: [], weather: null, market: [] };
    await Promise.all([
      settings.modules.includes('NEWS') ? this.dashboardNews(settings).then(value => { result.news = value; }).catch(error => { errors.news = error.message; }) : Promise.resolve(),
      settings.modules.includes('WEATHER') ? this.dashboardWeather(settings).then(value => { result.weather = value; }).catch(error => { errors.weather = error.message; }) : Promise.resolve(),
      (settings.modules.includes('MARKET') || settings.tickerEnabled) ? this.dashboardMarket(settings).then(value => { result.market = value; }).catch(error => { errors.market = error.message; }) : Promise.resolve(),
    ]);
    result.errors = errors;
    return result;
  }

  list() {
    return this.prisma.dataWidget.findMany({
      include: { media: { select: { id: true, name: true, createdAt: true, updatedAt: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private style(value: unknown) {
    const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const result: Record<string, string> = {};
    for (const key of ['primaryColor','accentColor','backgroundColor','textColor','mutedColor','logoUrl','companyName']) {
      const item = input[key];
      if (typeof item === 'string' && item.length <= 300) result[key] = item;
    }
    return {
      primaryColor: '#1769b0', accentColor: '#ffad2f', backgroundColor: '#06182b',
      textColor: '#ffffff', mutedColor: '#b8cadb', logoUrl: '/somai-logo.png', companyName: 'Somai Alimentos',
      ...result,
    };
  }

  private resolveSecrets(value: string) {
    return value.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, key: string) => {
      if (!key.startsWith('WIDGET_SECRET_')) throw new BadRequestException('Use somente variáveis WIDGET_SECRET_* na URL');
      const secret = process.env[key];
      if (!secret) throw new BadRequestException(`A variável ${key} não está configurada no servidor`);
      return encodeURIComponent(secret);
    });
  }

  private privateAddress(address: string) {
    return /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address)
      || /^(::1|fc|fd|fe80)/i.test(address);
  }

  private async safeUrl(raw: string) {
    let url: URL;
    try { url = new URL(this.resolveSecrets(raw)); }
    catch (error) { if (error instanceof BadRequestException) throw error; throw new BadRequestException('URL da API inválida'); }
    if (!['http:','https:'].includes(url.protocol)) throw new BadRequestException('A API deve usar HTTP ou HTTPS');
    const allowlist = (process.env.WIDGET_PRIVATE_HOST_ALLOWLIST ?? '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
    const allowed = allowlist.includes(url.hostname.toLowerCase());
    const addresses = await lookup(url.hostname, { all: true }).catch(() => []);
    if (!addresses.length) throw new BadRequestException('Não foi possível localizar o servidor da API');
    if (!allowed && addresses.some(item => this.privateAddress(item.address))) {
      throw new BadRequestException('API da rede interna bloqueada. Inclua o host em WIDGET_PRIVATE_HOST_ALLOWLIST');
    }
    return url.toString();
  }

  private async request(config: WidgetConfigDto | UpdateWidgetDto | AnalyzeWidgetDto) {
    let url = await this.safeUrl(config.endpoint);
    const headers: Record<string, string> = { Accept: 'application/json, application/rss+xml, application/atom+xml, text/xml;q=0.9' };
    if (config.authHeaderName || config.authEnvVar) {
      if (!config.authHeaderName || !config.authEnvVar) throw new BadRequestException('Informe o cabeçalho e a variável secreta juntos');
      const secret = process.env[config.authEnvVar];
      if (!secret) throw new BadRequestException(`A variável ${config.authEnvVar} não está configurada no servidor`);
      headers[config.authHeaderName] = config.authHeaderName.toLowerCase() === 'authorization' && !/^bearer /i.test(secret) ? `Bearer ${secret}` : secret;
    }
    let response: Response;
    try {
      let current: Response | undefined;
      for (let redirects = 0; redirects <= 3; redirects += 1) {
        current = await fetch(url, { redirect: 'manual', headers: { ...headers, 'User-Agent': 'Somai-Signage/1.0' }, signal: AbortSignal.timeout(12_000) });
        if (![301,302,303,307,308].includes(current.status)) break;
        const location = current.headers.get('location');
        if (!location) throw new Error('Redirecionamento sem destino');
        url = await this.safeUrl(new URL(location, url).toString());
        current = undefined;
      }
      if (!current) throw new Error('Limite de redirecionamentos excedido');
      response = current;
    } catch {
      throw new BadRequestException('Não foi possível consultar a API. Confira a URL, DNS, HTTPS e conexão do servidor');
    }
    if (!response.ok) throw new BadRequestException(`A API respondeu com HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > 2_000_000) throw new BadRequestException('A resposta da API ultrapassou 2 MB');
    try {
      if (!text.trim().startsWith('<')) return JSON.parse(text);
      const parsed: any = new XMLParser({ ignoreAttributes: false }).parse(text);
      const rss = parsed?.rss?.channel; const atom = parsed?.feed;
      const source = rss?.item ?? atom?.entry;
      if (!source) throw new Error('XML sem itens RSS/Atom');
      const items = (Array.isArray(source) ? source : [source]).map((item: any) => {
        const link = typeof item.link === 'object' ? item.link?.['@_href'] : item.link;
        const image = item.enclosure?.['@_url'] ?? item['media:content']?.['@_url'] ?? item['media:thumbnail']?.['@_url'];
        return { title: item.title, description: item.description ?? item.summary ?? item.content, image, link, source: rss?.title ?? atom?.title, publishedAt: item.pubDate ?? item.published ?? item.updated };
      });
      return { title: rss?.title ?? atom?.title, items };
    } catch { throw new BadRequestException('A fonte não retornou JSON, RSS ou Atom válido'); }
  }

  private findPath(value: any, aliases: string[], base = '$', depth = 0): string {
    if (!value || typeof value !== 'object' || depth > 4) return '';
    const keys = Object.keys(value);
    const exact = aliases.map(alias => keys.find(key => key.toLowerCase() === alias.toLowerCase())).find(Boolean);
    if (exact) return `${base}.${exact}`;
    const partial = aliases.map(alias => keys.find(key => key.toLowerCase().includes(alias.toLowerCase()))).find(Boolean);
    if (partial) return `${base}.${partial}`;
    for (const key of keys) {
      if (value[key] && typeof value[key] === 'object' && !Array.isArray(value[key])) {
        const found = this.findPath(value[key], aliases, `${base}.${key}`, depth + 1);
        if (found) return found;
      }
    }
    return '';
  }

  private findExactPath(value: any, aliases: string[], base = '$', depth = 0): string {
    if (!value || typeof value !== 'object' || depth > 4) return '';
    const keys = Object.keys(value); const exact = aliases.map(alias => keys.find(key => key.toLowerCase() === alias.toLowerCase())).find(Boolean);
    if (exact) return `${base}.${exact}`;
    for (const key of keys) {
      if (value[key] && typeof value[key] === 'object' && !Array.isArray(value[key])) {
        const found = this.findExactPath(value[key], aliases, `${base}.${key}`, depth + 1);
        if (found) return found;
      }
    }
    return '';
  }

  private leafPath(root: any, path: string, aliases: string[]) {
    if (!path) return '';
    const value = this.select(root, path);
    if (!value || typeof value !== 'object') return path;
    const nested = this.findPath(value, aliases);
    return nested ? `${path}${nested.slice(1)}` : path;
  }

  private arraySource(payload: any, base = '$', depth = 0): { path: string; items: any[] } | null {
    if (Array.isArray(payload)) return { path: `${base}[*]`, items: payload };
    if (!payload || typeof payload !== 'object' || depth > 3) return null;
    const preferred = ['articles','items','results','data','entries','noticias','news'];
    const keys = [...preferred.filter(key => key in payload), ...Object.keys(payload).filter(key => !preferred.includes(key))];
    for (const key of keys) {
      if (Array.isArray(payload[key]) && payload[key].length) return { path: `${base}.${key}[*]`, items: payload[key] };
    }
    for (const key of keys) {
      if (payload[key] && typeof payload[key] === 'object') {
        const found = this.arraySource(payload[key], `${base}.${key}`, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  private automaticConfig(name: string, dto: AnalyzeWidgetDto, payload: any): { config: WidgetConfigDto; confidence: number; reason: string } {
    const common = { name, endpoint: dto.endpoint, refreshSeconds: dto.refreshSeconds ?? 300, style: this.style(dto.style), authHeaderName: dto.authHeaderName, authEnvVar: dto.authEnvVar, enabled: true };
    const current = payload?.current;
    if (current && (current.temperature_2m !== undefined || current.temperature !== undefined)) {
      const mapping = { locationLabel: name, temperature: this.findPath(current,['temperature_2m','temperature','temp'],'$.current'), feelsLike: this.findPath(current,['apparent_temperature','feels_like','sensacao'],'$.current'), humidity: this.findPath(current,['relative_humidity_2m','humidity','umidade'],'$.current'), wind: this.findPath(current,['wind_speed_10m','wind_speed','vento'],'$.current'), condition: this.findPath(current,['weather_code','weathercode','condition'],'$.current'), forecastDates: this.findPath(payload?.daily,['time','date','dates'],'$.daily'), forecastMax: this.findPath(payload?.daily,['temperature_2m_max','temp_max','maximum'],'$.daily'), forecastMin: this.findPath(payload?.daily,['temperature_2m_min','temp_min','minimum'],'$.daily'), forecastRain: this.findPath(payload?.daily,['precipitation_probability_max','rain_probability','precipitation'],'$.daily') };
      return { config: { ...common, template: 'WEATHER', mapping } as WidgetConfigDto, confidence: 99, reason: 'Temperatura atual e previsão meteorológica detectadas' };
    }
    const array = this.arraySource(payload); const item = array?.items?.find(value => value && typeof value === 'object') ?? null;
    if (item) {
      const symbol = this.findPath(item,['symbol','ticker','codigo']); const price = this.findPath(item,['regularMarketPrice','price','preco','bid','lastPrice']); const change = this.findPath(item,['regularMarketChangePercent','changePercent','pctChange','variacao']);
      if (symbol && price) {
        const mapping = { title: name, repeatPath: array!.path, symbol, name: this.findPath(item,['shortName','longName','name','nome']), price, change, logo: this.leafPath(item, this.findPath(item,['logourl','logo','image']), ['url','src']) };
        return { config: { ...common, template: 'MARKET_TICKER', mapping } as WidgetConfigDto, confidence: 97, reason: 'Símbolos, preços e variações de mercado detectados' };
      }
      const title = this.findPath(item,['title','headline','titulo','name','nome']);
      const description = this.findPath(item,['description','summary','content','descricao','resumo','contentSnippet']);
      let publishedAt = this.findExactPath(item,['publishedAt','pubDate','published','date','data','updated']);
      if (publishedAt && typeof this.select(item, publishedAt) === 'object') publishedAt = '';
      const articleLink = this.findExactPath(item,['link','url','href']);
      const image = this.leafPath(item, this.findExactPath(item,['urlToImage','imageUrl','thumbnailUrl','image','thumbnail','imagem']), ['url','src','href']);
      if (title && (description || publishedAt || articleLink)) {
        const source = this.leafPath(item, this.findPath(item,['source','fonte','author']), ['name','nome','title']);
        const mapping = { title: name, repeatPath: array!.path, titlePath: title, description, image, source, publishedAt, link: articleLink };
        return { config: { ...common, template: 'NEWS', mapping } as WidgetConfigDto, confidence: 96, reason: 'Coleção de notícias com títulos e conteúdo detectada' };
      }
      const label = this.findPath(item,['label','name','nome','title','titulo']); const value = this.findPath(item,['value','valor','total','amount','quantidade']);
      if (array!.items.length > 1 && label && value) {
        const mapping = { title: name, repeatPath: array!.path, label, value, target: this.findPath(item,['target','meta','goal']), unit: this.findPath(item,['unit','unidade']) };
        return { config: { ...common, template: 'KPI_GRID', mapping } as WidgetConfigDto, confidence: 91, reason: 'Lista de indicadores e valores detectada' };
      }
      if (array!.items.length === 1 && value) {
        const mapping = { label, value: `${array!.path.replace(/\[\*\]$/, '[0]')}${value.slice(1)}`, subtitle: '', trend: this.findPath(item,['change','trend','variacao']), updatedAt: this.findPath(item,['date','data','updatedAt']), suffix: '' };
        for (const key of ['label','trend','updatedAt']) if ((mapping as any)[key]) (mapping as any)[key] = `${array!.path.replace(/\[\*\]$/, '[0]')}${(mapping as any)[key].slice(1)}`;
        return { config: { ...common, template: 'KPI', mapping } as WidgetConfigDto, confidence: 88, reason: 'Indicador único detectado' };
      }
      const primitive = Object.keys(item).filter(key => ['string','number','boolean'].includes(typeof item[key])).slice(0,6);
      const columns = primitive.map(key => ({ label: key.replace(/([A-Z])/g,' $1').replace(/^./,letter=>letter.toUpperCase()), key, path: `$.${key}` }));
      return { config: { ...common, template: 'TABLE', mapping: { title: name, repeatPath: array!.path, columns } } as WidgetConfigDto, confidence: 76, reason: 'Coleção genérica detectada e convertida em tabela' };
    }
    const value = this.findPath(payload,['value','valor','total','price','preco','bid']);
    if (value) {
      const mapping = { label: this.findPath(payload,['name','nome','label','title']), value, subtitle: this.findPath(payload,['description','descricao']), trend: this.findPath(payload,['change','pctChange','variacao']), updatedAt: this.findPath(payload,['updatedAt','date','data','create_date']), suffix: '' };
      return { config: { ...common, template: 'KPI', mapping } as WidgetConfigDto, confidence: 82, reason: 'Valor principal detectado no objeto' };
    }
    throw new BadRequestException('Não foi possível reconhecer automaticamente esta estrutura. Use o modo avançado para mapear os campos');
  }

  private tokens(path: string) {
    if (!path || path === '$') return [];
    const tokens: string[] = [];
    path.replace(/^\$\.?/, '').replace(/([^[.]+)|\[(\d+|\*)\]/g, (_all, property, index) => {
      tokens.push(property ?? index); return '';
    });
    return tokens;
  }

  private select(root: unknown, path?: unknown): any {
    if (typeof path !== 'string' || !path.trim()) return undefined;
    let values: any[] = [root]; let wildcard = false;
    for (const token of this.tokens(path)) {
      if (token === '*') { wildcard = true; values = values.flatMap(value => Array.isArray(value) ? value : []); }
      else values = values.map(value => value?.[token]).filter(value => value !== undefined && value !== null);
    }
    return wildcard || values.length > 1 ? values : values[0];
  }

  private text(value: unknown, fallback = '') {
    if (value === undefined || value === null) return fallback;
    return (typeof value === 'object' ? JSON.stringify(value) : String(value)).replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim();
  }

  private repeat(payload: unknown, path: unknown) {
    const value = this.select(payload, path);
    return Array.isArray(value) ? value.slice(0, 30) : value === undefined ? [] : [value];
  }

  private normalize(name: string, config: WidgetConfigDto | UpdateWidgetDto, payload: unknown, id?: string): WidgetView {
    const map = config.mapping as Record<string, any>;
    const field = (key: string, root: unknown = payload) => this.select(root, map[key]);
    let data: unknown;
    if (config.template === 'INFORMATIVE_DASHBOARD') {
      data = payload;
    } else if (config.template === 'NEWS') {
      data = { title: map.title || name, items: this.repeat(payload, map.repeatPath).map(item => ({
        title: this.text(this.select(item, map.titlePath)), description: this.text(this.select(item, map.description)),
        image: this.select(item, map.image), source: this.text(this.select(item, map.source)),
        publishedAt: this.select(item, map.publishedAt), link: this.select(item, map.link),
      })).filter(item => item.title) };
    } else if (config.template === 'KPI') {
      data = { label: this.text(field('label'), name), value: field('value'), subtitle: this.text(field('subtitle')), trend: field('trend'), updatedAt: field('updatedAt'), suffix: this.text(map.suffix) };
    } else if (config.template === 'WEATHER') {
      const dates = field('forecastDates'); const maxima = field('forecastMax'); const minima = field('forecastMin'); const rain = field('forecastRain');
      const length = Math.min(7, Math.max(Array.isArray(dates) ? dates.length : 0, Array.isArray(maxima) ? maxima.length : 0));
      data = {
        location: this.text(field('location'), map.locationLabel || name), temperature: field('temperature'), feelsLike: field('feelsLike'),
        humidity: field('humidity'), wind: field('wind'), condition: field('condition'),
        forecast: Array.from({ length }, (_, index) => ({ date: dates?.[index], max: maxima?.[index], min: minima?.[index], rain: rain?.[index] })),
      };
    } else if (config.template === 'MARKET_TICKER') {
      data = { title: map.title || name, items: this.repeat(payload, map.repeatPath).map(item => ({ symbol: this.text(this.select(item, map.symbol)), name: this.text(this.select(item, map.name)), price: this.select(item, map.price), change: this.select(item, map.change), logo: this.select(item, map.logo) })) };
    } else if (config.template === 'KPI_GRID') {
      data = { title: map.title || name, items: this.repeat(payload, map.repeatPath).map(item => ({ label: this.text(this.select(item, map.label)), value: this.select(item, map.value), target: this.select(item, map.target), unit: this.text(this.select(item, map.unit)) })) };
    } else if (config.template === 'TABLE') {
      const columns = Array.isArray(map.columns) ? map.columns.slice(0, 8) : [];
      data = { title: map.title || name, columns: columns.map((column: any) => ({ label: this.text(column.label), key: this.text(column.key) })), rows: this.repeat(payload, map.repeatPath).map(item => Object.fromEntries(columns.map((column: any) => [column.key, this.select(item, column.path)]))) };
    } else {
      data = { title: map.title || name, items: this.repeat(payload, map.repeatPath).map(item => ({ title: this.text(this.select(item, map.titlePath ?? map.label)), description: this.text(this.select(item, map.description)), value: this.select(item, map.value) })) };
    }
    return { id, name, template: config.template, refreshSeconds: config.refreshSeconds, updatedAt: new Date().toISOString(), style: this.style(config.style), data };
  }

  async preview(dto: WidgetConfigDto) {
    const sample = dto.template === 'INFORMATIVE_DASHBOARD' ? await this.dashboardPayload(dto) : await this.request(dto);
    return { sample, view: this.normalize(dto.name, dto, sample) };
  }

  async analyze(dto: AnalyzeWidgetDto) {
    const sample = await this.request(dto);
    const detected = this.automaticConfig(dto.name.trim(), dto, sample);
    return { ...detected, sample, view: this.normalize(dto.name.trim(), detected.config, sample) };
  }

  async create(dto: WidgetConfigDto) {
    if (dto.template === 'INFORMATIVE_DASHBOARD') await this.dashboardPayload(dto); else await this.request(dto);
    return this.prisma.$transaction(async tx => {
      const media = await tx.media.create({ data: { name: dto.name.trim(), type: MediaType.WIDGET, feedRefreshSec: dto.refreshSeconds } });
      return tx.dataWidget.create({ data: {
        mediaId: media.id, endpoint: dto.endpoint, template: dto.template, refreshSeconds: dto.refreshSeconds,
        mapping: dto.mapping as any, style: this.style(dto.style), authHeaderName: dto.authHeaderName || null,
        authEnvVar: dto.authEnvVar || null, enabled: dto.enabled ?? true,
      }, include: { media: true } });
    });
  }

  async update(id: string, dto: UpdateWidgetDto) {
    const current = await this.prisma.dataWidget.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Widget não encontrado');
    if (dto.template === 'INFORMATIVE_DASHBOARD') await this.dashboardPayload(dto); else await this.request(dto);
    this.cache.delete(id);
    return this.prisma.$transaction(async tx => {
      await tx.media.update({ where: { id: current.mediaId }, data: { name: dto.name.trim(), feedRefreshSec: dto.refreshSeconds } });
      return tx.dataWidget.update({ where: { id }, data: {
        endpoint: dto.endpoint, template: dto.template, refreshSeconds: dto.refreshSeconds, mapping: dto.mapping as any,
        style: this.style(dto.style), authHeaderName: dto.authHeaderName || null, authEnvVar: dto.authEnvVar || null,
        enabled: dto.enabled ?? true, lastError: null,
      }, include: { media: true } });
    });
  }

  async remove(id: string) {
    const widget = await this.prisma.dataWidget.findUnique({ where: { id } });
    if (!widget) throw new NotFoundException('Widget não encontrado');
    this.cache.delete(id);
    return this.media.remove(widget.mediaId);
  }

  async data(id: string) {
    const widget = await this.prisma.dataWidget.findUnique({ where: { id }, include: { media: true } });
    if (!widget || !widget.enabled) throw new NotFoundException('Widget indisponível');
    const cached = this.cache.get(id);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const config = { ...widget, name: widget.media.name, mapping: widget.mapping as Record<string, unknown>, style: widget.style as Record<string, unknown> } as unknown as WidgetConfigDto;
    try {
      let payload = config.template === 'INFORMATIVE_DASHBOARD' ? await this.dashboardPayload(config) : await this.request(config);
      if (config.template === 'INFORMATIVE_DASHBOARD' && cached) {
        const next = payload as Record<string, any>;
        const previous = cached.value.data as Record<string, any>;
        if (!next.news?.length && previous?.news?.length) next.news = previous.news;
        if (!next.weather && previous?.weather) next.weather = previous.weather;
        if (!next.market?.length && previous?.market?.length) next.market = previous.market;
        payload = next;
      }
      const value = this.normalize(widget.media.name, config, payload, id);
      this.cache.set(id, { expiresAt: Date.now() + widget.refreshSeconds * 1000, value });
      await this.prisma.dataWidget.update({ where: { id }, data: { lastSuccessAt: new Date(), lastError: null } }).catch(() => undefined);
      return value;
    } catch (error) {
      await this.prisma.dataWidget.update({ where: { id }, data: { lastError: (error as Error).message.slice(0, 500) } }).catch(() => undefined);
      if (cached) return { ...cached.value, stale: true };
      throw error;
    }
  }
}
