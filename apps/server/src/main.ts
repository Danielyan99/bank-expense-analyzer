import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AiCategorizerService } from './categorization/ai-categorizer.service';
import { loadConfig } from './config/configuration';

async function bootstrap() {
  try {
    process.loadEnvFile(); // apps/server/.env for local development
  } catch {
    // No .env file: rely on the real environment (e.g. Render).
  }
  const config = loadConfig();

  const app = await NestFactory.create(AppModule.forRoot(config));
  app.enableCors({ origin: config.corsOrigins });
  // Render sits behind a proxy; trust it so the rate limiter sees the real client IP.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
  Logger.log(`Listening on :${config.port} · AI ${app.get(AiCategorizerService).description}`, 'Bootstrap');
}

void bootstrap();
