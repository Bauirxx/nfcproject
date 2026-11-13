import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

/** Arranque do backend. A configuração é validada primeiro; cabeçalhos de segurança e CORS fechado (CLAUDE.md, regra 9). */
async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: false });

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

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(env.PORT);
}

void bootstrap();
