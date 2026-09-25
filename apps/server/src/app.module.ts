import { Controller, DynamicModule, Get, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ThrottlerModule } from '@nestjs/throttler';
import { AiCategorizerService } from './categorization/ai-categorizer.service';
import { APP_CONFIG, type AppConfig } from './config/configuration';
import { StatementsController } from './statements/statements.controller';
import { StatementsService } from './statements/statements.service';

@Controller()
class HealthController {
  constructor(private readonly ai: AiCategorizerService) {}

  @Get('health')
  health() {
    return { status: 'ok', ai: this.ai.enabled ? 'enabled' : 'disabled' };
  }
}

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        // Files stay in memory and are dropped after the request: nothing touches the disk.
        MulterModule.register({ limits: { fileSize: config.maxUploadBytes, files: 1 } }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: config.rateLimitPerMinute }]),
      ],
      controllers: [HealthController, StatementsController],
      providers: [{ provide: APP_CONFIG, useValue: config }, AiCategorizerService, StatementsService],
    };
  }
}
