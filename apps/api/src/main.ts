import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { static as serveStatic, Request, Response } from 'express';
import { AppModule } from './app.module';
import { openApiDocument } from './openapi';

const swaggerUiDist = require('swagger-ui-dist');

async function bootstrap() {
  (BigInt.prototype as any).toJSON = function () { return this.toString(); };
  const app = await NestFactory.create(AppModule);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174').split(',').map(value => value.trim()).filter(Boolean).map(value => /^https?:\/\//i.test(value) ? value.replace(/\/$/, '') : `http://${value.replace(/^\/+|\/$/g, '')}`);
  app.enableCors({ origin: origins, credentials: true, exposedHeaders: ['Content-Range', 'Accept-Ranges'] });

  app.use('/docs-assets', serveStatic(swaggerUiDist.getAbsoluteFSPath(), { immutable: true, maxAge: '1d' }));
  app.use('/openapi.json', (_req: Request, res: Response) => res.json(openApiDocument));
  app.use('/docs-init.js', (_req: Request, res: Response) => res.type('application/javascript').send("window.onload=()=>SwaggerUIBundle({url:'/openapi.json',dom_id:'#swagger-ui',deepLinking:true,presets:[SwaggerUIBundle.presets.apis,SwaggerUIStandalonePreset],layout:'StandaloneLayout'});"));
  app.use('/docs', (_req: Request, res: Response) => res.type('html').send('<!doctype html><html><head><meta charset="utf-8"><title>Corporate Signage API</title><link rel="stylesheet" href="/docs-assets/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="/docs-assets/swagger-ui-bundle.js"></script><script src="/docs-assets/swagger-ui-standalone-preset.js"></script><script src="/docs-init.js"></script></body></html>'));
  // Railway injeta PORT. API_PORT continua disponível para Docker/local.
  await app.listen(Number(process.env.PORT ?? process.env.API_PORT ?? 3000), '0.0.0.0');
}
bootstrap();
