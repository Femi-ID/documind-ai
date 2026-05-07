import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { MINIO_TOKEN } from './decorators/minio.decorator';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private bucketName: string;

  constructor(
    @Inject(MINIO_TOKEN) private readonly minioClient: Minio.Client,
    private configService: ConfigService,
  ) {
    this.bucketName =
      this.configService.getOrThrow<string>('MINIO_BUCKET_NAME');
  }

  async onModuleInit(): Promise<void> {
    const bucketExists = await this.minioClient.bucketExists(this.bucketName);
    if (!bucketExists) {
      await this.minioClient.makeBucket(this.bucketName);
      this.logger.log(`Bucket ${this.bucketName} created successfully.`);
    } else {
      this.logger.log(`Bucket ${this.bucketName} already exists.`);
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = '',
  ): Promise<{ objectName: string; etag: string }> {
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/\s+/g, '-');
    const objectName = folder
      ? `${folder}/${timestamp}-${sanitizedName}`
      : `${timestamp}-${sanitizedName}`;
    const etag = await this.minioClient.putObject(
      this.bucketName,
      objectName,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype },
    );

    this.logger.log(
      `File uploaded: ${objectName} (etag: ${JSON.stringify(etag)})`,
    );
    return { objectName, etag: etag.etag };
  }

  async getPresignedUrl(
    objectName: string,
    expiry: number = 3600,
  ): Promise<string> {
    return await this.minioClient.presignedGetObject(
      this.bucketName,
      objectName,
      expiry,
    );
  }

  async getFile(objectName: string): Promise<NodeJS.ReadableStream> {
    return await this.minioClient.getObject(this.bucketName, objectName);
  }

  async deleteFile(objectName: string): Promise<void> {
    await this.minioClient.removeObject(this.bucketName, objectName);
    this.logger.log(`File deleted ${objectName}`);
  }

  async listFiles(prefix: string = ''): Promise<Minio.BucketItem[]> {
    return new Promise((resolve, reject) => {
      const items: Minio.BucketItem[] = [];
      const stream = this.minioClient.listObjectsV2(
        this.bucketName,
        prefix,
        true,
      );
      stream.on('data', (obj) => items.push(obj));
      stream.on('end', () => resolve(items));
      stream.on('error', (err) => reject(err));
    });
  }
}
