import { Global, Module } from '@nestjs/common';
import { MinioService } from './minio.service';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { MINIO_TOKEN } from './decorators/minio.decorator';
import { UsersModule } from 'src/users/users.module';

@Global()
@Module({
  providers: [
    MinioService,
    {
      inject: [ConfigService],
      provide: MINIO_TOKEN,
      useFactory: (configService: ConfigService) => {
        return new Minio.Client({
          endPoint: configService.getOrThrow('MINIO_ENDPOINT'),
          port: +configService.getOrThrow('MINIO_PORT'),
          accessKey: configService.getOrThrow('MINIO_ACCESS_KEY'),
          secretKey: configService.getOrThrow('MINIO_SECRET_KEY'),
          useSSL: configService.get('MINIO_USE_SSL') === 'true',
        });
      },
    },
  ],
  exports: [MINIO_TOKEN, MinioService],
  imports: [UsersModule],
})
export class MinioModule {}
