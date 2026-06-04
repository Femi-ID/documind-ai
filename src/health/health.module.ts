import { Module } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthController } from './health.controller';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MinioModule } from 'src/minio/minio.module';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { MinioHealthIndicator } from './indicators/minio.health';
import { OllamaHealthIndicator } from './indicators/ollama.health';

@Module({
  imports: [TerminusModule, PrismaModule, MinioModule],
  controllers: [HealthController],
  providers: [
    HealthService,
    PrismaHealthIndicator,
    RedisHealthIndicator,
    MinioHealthIndicator,
    OllamaHealthIndicator,
  ],
})
export class HealthModule {}
