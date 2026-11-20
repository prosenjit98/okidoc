import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { config } from './config';
import { PUBLIC_DIR } from './modules/storage/storage.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: config.isProd ? config.corsOrigins : true, credentials: true });
  app.useBodyParser('json', { limit: '1mb' });
  app.useStaticAssets(PUBLIC_DIR(), { prefix: '/files/public', maxAge: '7d', index: false });
  app.setGlobalPrefix('api/v1', { exclude: ['c/:code'] });
  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
  Logger.log(`Okidoc API on http://localhost:${config.port}/api/v1  (gateway=${config.paymentGateway}, sms=${config.smsProvider})`, 'Bootstrap');
}

bootstrap();
