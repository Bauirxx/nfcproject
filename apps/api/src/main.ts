import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { JsonLogger } from './common/json-logger';
import { requestLogging } from './common/request-logging';
import { RequestMonitor } from './common/request-monitor';
import { loadEnv } from './config/env';
import { LIMITS } from '@nfc-business/shared/constants';

const logger = new JsonLogger();

/** Arranque do backend. A configuração é validada primeiro; cabeçalhos de segurança e CORS fechado (CLAUDE.md, regra 9). */
async function bootstrap(): Promise<void> {
  // Carrega o `.env` local (desenvolvimento); em produção a configuração vem do ambiente do processo.
  try {
    process.loadEnvFile();
  } catch {
    // Sem ficheiro `.env`: usa o ambiente já definido.
  }
  const env = loadEnv();
  // Logs em JSON com request_id em toda a aplicação (regra 11, ADR-0021).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: false, logger });

  // Primeiro middleware: todos os pedidos (incluindo os recusados mais à frente) têm request_id e log de acesso.
  app.use(requestLogging(logger, app.get(RequestMonitor)));
  app.use(
    helmet({
      hsts: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
      contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], frameAncestors: ["'none'"] } },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  // IP real do visitante atrás do Vercel e do Render (limites e hash dos IPs). Só confia no número de saltos configurado.
  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  // Corpo binário só para a receção de imagens (regra 8): até 2 MB e só os tipos aceites. Erros saem em JSON.
  const rawImages = express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: LIMITS.uploadMaxBytes + 1 });
  app.use('/api/uploads', (request: Request, response: Response, next: NextFunction) => {
    rawImages(request, response, (error?: unknown) => {
      if (!error) return next();
      const tooLarge = (error as { type?: string }).type === 'entity.too.large';
      response.status(tooLarge ? 413 : 400).json({ error: { code: tooLarge ? 'file_too_large' : 'invalid_request' } });
    });
  });

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(env.PORT);
}

bootstrap().catch((error: unknown) => {
  // A mensagem de configuração inválida lista só nomes de variáveis, nunca valores.
  logger.fatal(error instanceof Error ? error.message : 'Falha no arranque', 'Bootstrap');
  process.exit(1);
});
