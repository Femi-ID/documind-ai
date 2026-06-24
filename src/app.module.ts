import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { MinioModule } from './minio/minio.module';
import { DocumentModule } from './document/document.module';
import { QueueModule } from './queue/queue.module';
import { ConversationModule } from './conversation/conversation.module';
import { CollectionsModule } from './collections/collections.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { CustomThrottlers } from './common/constants/custom-throttlers.constant';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { QueryCacheModule } from './query-cache/query-cache.module';
import { MetricsModule } from './metrics/metrics.module';
import { HealthModule } from './health/health.module';
import { buildRedisOptions } from './common/utils/redis-options';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    PrismaModule,
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      expandVariables: true,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            // TODO: set up multiple throttling definitions and use one as the default global throttler
            name: CustomThrottlers.DEFAULT,
            ttl: parseInt(config.getOrThrow('THROTTLE_TTL'), 10),
            limit: parseInt(config.getOrThrow('DEFAULT_THROTTLE_LIMIT'), 10),
          },
          {
            name: CustomThrottlers.STRICT,
            ttl: parseInt(config.getOrThrow('THROTTLE_TTL'), 10),
            limit: parseInt(config.getOrThrow('STRICT_THROTTLE_LIMIT'), 10),
          },
          {
            name: CustomThrottlers.MODERATE,
            ttl: parseInt(config.getOrThrow('THROTTLE_TTL'), 10),
            limit: parseInt(config.getOrThrow('MODERATE_THROTTLE_LIMIT'), 10),
          },
        ],
        storage: new ThrottlerStorageRedisService(
          new Redis(buildRedisOptions(config)),
        ),
      }),
    }),
    MinioModule,
    DocumentModule,
    QueueModule,
    ConversationModule,
    CollectionsModule,
    QueryCacheModule,
    MetricsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
