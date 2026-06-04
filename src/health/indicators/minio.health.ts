import { Inject, Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { MINIO_TOKEN } from 'src/minio/decorators/minio.decorator';
import * as Minio from 'minio';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MinioHealthIndicator {
  private readonly bucketName: string;

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(MINIO_TOKEN) private readonly minioClient: Minio.Client,
    private readonly configService: ConfigService,
  ) {
    this.bucketName =
      this.configService.getOrThrow<string>('MINIO_BUCKET_NAME');
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      return indicator.up({ bucket: this.bucketName, exists });
    } catch (error) {
      return indicator.down({ message: error.message });
    }
  }
}
