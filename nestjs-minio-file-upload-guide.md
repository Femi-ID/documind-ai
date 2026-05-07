# NestJS + MinIO File Upload Guide

> A senior engineer's walkthrough for setting up document uploads with NestJS and MinIO running in Docker.

---

## 1. What Is MinIO and Why Use It?

MinIO is an **open-source, S3-compatible object storage server**. Think of it as your own private Amazon S3 that runs locally or on your own infrastructure.

**Why MinIO instead of just saving files to disk?**

- **S3-compatible API** — your code works with MinIO locally and AWS S3 in production with zero changes. You just swap the endpoint.
- **Scalable** — handles millions of objects without the headaches of a flat filesystem.
- **Metadata & versioning** — built-in support for tagging, lifecycle rules, and object versioning.
- **Web console** — a browser UI to inspect your buckets and objects visually.
- **Decoupled storage** — your app server stays stateless; files live in a dedicated service.

**Key concepts to understand:**

| Term | What it means |
|---|---|
| **Bucket** | A top-level container (like a folder/directory). Example: `documents`, `avatars`. |
| **Object** | A single file stored inside a bucket. Identified by a unique key (path). |
| **Key** | The unique path/name of an object within a bucket. Example: `invoices/2025/receipt.pdf`. |
| **Presigned URL** | A temporary, signed URL that lets someone download/upload without credentials. |
| **Endpoint** | The URL where MinIO is reachable. Locally: `http://localhost:9000`. |

---

## 2. Project Architecture Overview

Here's the big picture of what we're building:

```
┌─────────────┐       HTTP/Multipart        ┌──────────────┐       S3 API        ┌─────────────┐
│   Client     │  ───────────────────────▶   │   NestJS     │  ────────────────▶  │   MinIO     │
│  (Postman/   │                             │   Backend    │                     │  (Docker)   │
│   Frontend)  │  ◀───────────────────────   │              │  ◀────────────────  │  Port 9000  │
└─────────────┘       JSON Response          └──────────────┘     File bytes      └─────────────┘
                                                                                   Console: 9001
```

The flow:
1. Client sends a file via `multipart/form-data` POST request.
2. NestJS receives it, validates it, and streams it to MinIO.
3. MinIO stores the object in a bucket and confirms.
4. NestJS returns metadata (filename, URL, size) to the client.

---

## 3. Prerequisites

Make sure these are installed:

- **Node.js** ≥ 18 (run `node -v`)
- **npm** or **yarn**
- **Docker** & **Docker Compose** (run `docker --version` and `docker compose version`)
- **NestJS CLI** — install globally: `npm i -g @nestjs/cli`

---

## 4. Step 1 — Spin Up MinIO with Docker Compose

Create a `docker-compose.yml` in your project root:

```yaml
# docker-compose.yml
version: '3.8'

services:
  minio:
    image: minio/minio:latest
    container_name: minio-storage
    ports:
      - '9000:9000'   # S3 API
      - '9001:9001'   # Web Console
    environment:
      MINIO_ROOT_USER: minioadmin          # your access key
      MINIO_ROOT_PASSWORD: minioadmin123   # your secret key (use a strong one!)
    volumes:
      - minio_data:/data                   # persist data across restarts
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  minio_data:
    driver: local
```

**Start it up:**

```bash
docker compose up -d
```

**Verify it works:**

- S3 API: open `http://localhost:9000` — you should get an XML response.
- Web Console: open `http://localhost:9001` — log in with `minioadmin` / `minioadmin123`.

> **Pro tip:** Create your first bucket (`documents`) manually in the console to confirm everything is working. We'll automate this in code later.

---

## 5. Step 2 — Scaffold the NestJS Project

```bash
nest new nestjs-minio-upload
cd nestjs-minio-upload
```

**Install the dependencies we need:**

```bash
npm install minio                   # official MinIO JS SDK
npm install @nestjs/config          # for environment variables
npm install -D @types/multer        # type definitions for file uploads
```

> **Why `minio` and not `aws-sdk`?** The `minio` npm package is lighter and purpose-built. That said, `@aws-sdk/client-s3` also works since MinIO is S3-compatible — but for learning, the MinIO SDK has a simpler API.

---

## 6. Step 3 — Environment Configuration

Create a `.env` file in the project root:

```env
# .env
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_NAME=documents
```

Wire it into NestJS by importing `ConfigModule` in `app.module.ts`:

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MinioModule } from './minio/minio.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,   // available everywhere, no need to re-import
    }),
    MinioModule,
    UploadModule,
  ],
})
export class AppModule {}
```

---

## 7. Step 4 — Create the MinIO Service

Generate the module and service:

```bash
nest g module minio
nest g service minio
```

Now write the service — this is the core of the integration:

```typescript
// src/minio/minio.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private minioClient: Minio.Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    // Initialize the MinIO client with credentials from .env
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT'),
      port: parseInt(this.configService.get<string>('MINIO_PORT'), 10),
      useSSL: this.configService.get<string>('MINIO_USE_SSL') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY'),
    });

    this.bucketName = this.configService.get<string>('MINIO_BUCKET_NAME');
  }

  /**
   * Runs once when the module initializes.
   * Ensures the bucket exists — creates it if it doesn't.
   */
  async onModuleInit(): Promise<void> {
    const bucketExists = await this.minioClient.bucketExists(this.bucketName);
    if (!bucketExists) {
      await this.minioClient.makeBucket(this.bucketName);
      this.logger.log(`Bucket "${this.bucketName}" created successfully.`);
    } else {
      this.logger.log(`Bucket "${this.bucketName}" already exists.`);
    }
  }

  /**
   * Upload a file buffer to MinIO.
   * Returns the object name (key) used to store it.
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = '',
  ): Promise<{ objectName: string; etag: string }> {
    // Build a unique object name to avoid collisions
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/\s+/g, '-');
    const objectName = folder
      ? `${folder}/${timestamp}-${sanitizedName}`
      : `${timestamp}-${sanitizedName}`;

    // Upload the buffer to MinIO
    const etag = await this.minioClient.putObject(
      this.bucketName,
      objectName,
      file.buffer,
      file.size,
      {
        'Content-Type': file.mimetype,
        // You can add custom metadata here
        'X-Original-Name': file.originalname,
      },
    );

    this.logger.log(`File uploaded: ${objectName} (etag: ${etag})`);

    return { objectName, etag: etag.etag };
  }

  /**
   * Generate a presigned URL for temporary, secure download.
   * Expires in `expiry` seconds (default: 1 hour).
   */
  async getPresignedUrl(
    objectName: string,
    expiry: number = 3600,
  ): Promise<string> {
    return this.minioClient.presignedGetObject(
      this.bucketName,
      objectName,
      expiry,
    );
  }

  /**
   * Get the file as a readable stream (for proxying downloads).
   */
  async getFile(objectName: string): Promise<NodeJS.ReadableStream> {
    return this.minioClient.getObject(this.bucketName, objectName);
  }

  /**
   * Delete a file from the bucket.
   */
  async deleteFile(objectName: string): Promise<void> {
    await this.minioClient.removeObject(this.bucketName, objectName);
    this.logger.log(`File deleted: ${objectName}`);
  }

  /**
   * List all objects in a folder/prefix.
   */
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
```

Export the service from its module:

```typescript
// src/minio/minio.module.ts
import { Module } from '@nestjs/common';
import { MinioService } from './minio.service';

@Module({
  providers: [MinioService],
  exports: [MinioService],   // <-- so other modules can inject it
})
export class MinioModule {}
```

---

## 8. Step 5 — Create the Upload Controller

Generate the upload module and controller:

```bash
nest g module upload
nest g controller upload
```

```typescript
// src/upload/upload.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MinioService } from '../minio/minio.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly minioService: MinioService) {}

  /**
   * POST /upload
   * Accepts a single file under the field name "file".
   */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          // Max 10 MB
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          // Allow common document types
          new FileTypeValidator({
            fileType: /(pdf|doc|docx|txt|png|jpg|jpeg|xlsx|csv)$/i,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Query('folder') folder?: string,
  ) {
    const result = await this.minioService.uploadFile(file, folder);
    const url = await this.minioService.getPresignedUrl(result.objectName);

    return {
      message: 'File uploaded successfully',
      objectName: result.objectName,
      downloadUrl: url,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  /**
   * GET /upload/:objectName
   * Returns a presigned download URL for the given object.
   */
  @Get('url/*')
  async getDownloadUrl(@Param() params: string[]) {
    // The wildcard captures the full object path
    const objectName = params['0'];
    const url = await this.minioService.getPresignedUrl(objectName);
    return { downloadUrl: url };
  }

  /**
   * GET /upload/list
   * Lists files, optionally filtered by prefix/folder.
   */
  @Get('list')
  async listFiles(@Query('prefix') prefix?: string) {
    const files = await this.minioService.listFiles(prefix);
    return {
      count: files.length,
      files: files.map((f) => ({
        name: f.name,
        size: f.size,
        lastModified: f.lastModified,
      })),
    };
  }

  /**
   * DELETE /upload/:objectName
   */
  @Delete('*')
  async deleteFile(@Param() params: string[]) {
    const objectName = params['0'];
    await this.minioService.deleteFile(objectName);
    return { message: `Deleted: ${objectName}` };
  }
}
```

Wire it up:

```typescript
// src/upload/upload.module.ts
import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { MinioModule } from '../minio/minio.module';

@Module({
  imports: [MinioModule],
  controllers: [UploadController],
})
export class UploadModule {}
```

---

## 9. Step 6 — Handle Multer Memory Storage

By default, NestJS uses Multer with disk storage. For streaming to MinIO, **memory storage** is simpler (the whole file sits in a buffer). This is fine for documents up to ~50 MB. For very large files, you'd switch to streaming — but don't over-engineer early.

No extra config is needed — `FileInterceptor('file')` uses memory storage by default in NestJS. The file lands in `file.buffer`.

> **Watch out:** If you add `MulterModule.register({ dest: './uploads' })`, Multer will write to disk and `file.buffer` will be `undefined`. Don't mix the two approaches.

---

## 10. Step 7 — Test It

**Start the NestJS app:**

```bash
npm run start:dev
```

**Upload a file with cURL:**

```bash
curl -X POST http://localhost:3000/upload \
  -F "file=@./sample-invoice.pdf" \
  -F "folder=invoices"
```

**Expected response:**

```json
{
  "message": "File uploaded successfully",
  "objectName": "invoices/1715100000000-sample-invoice.pdf",
  "downloadUrl": "http://localhost:9000/documents/invoices/...",
  "size": 245678,
  "mimetype": "application/pdf"
}
```

**List files:**

```bash
curl http://localhost:3000/upload/list?prefix=invoices
```

Open the MinIO Console at `http://localhost:9001` and check the `documents` bucket — your file should be there.

---

## 11. Common Gotchas & Things to Watch For

### "Connection refused" to MinIO
If NestJS runs on the host but MinIO is in Docker, `localhost:9000` should work. If NestJS is also in Docker, use the service name `minio:9000` instead (Docker networking).

### File buffer is `undefined`
You probably registered Multer with disk storage somewhere. Remove any `MulterModule.register()` with a `dest` option.

### CORS issues from a frontend
Add a bucket policy in MinIO or configure CORS. For development, the MinIO Console lets you set this under **Buckets → your bucket → Access Rules**.

### Presigned URLs returning `localhost` in production
The presigned URL uses whatever `endPoint` you configured. In production, this must be the public hostname or load balancer URL, not `localhost`.

### Large files crashing Node
Memory storage holds the entire file in RAM. For files over ~50 MB, stream directly from the request to MinIO using `busboy` or Multer's disk storage + `fPutObject()`.

---

## 12. Production Checklist

Before going to production, address these:

- **Strong credentials** — rotate `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`. Never commit them. Use a secrets manager.
- **TLS/SSL** — enable HTTPS on MinIO (set `useSSL: true` and provide certs) or terminate TLS at a reverse proxy.
- **Bucket policies** — restrict public access. Use presigned URLs for controlled downloads.
- **File validation** — validate MIME types server-side (don't trust the client). Consider running virus scans on uploads.
- **Rate limiting** — add `@nestjs/throttler` to prevent upload abuse.
- **Persistent volumes** — ensure `minio_data` maps to a reliable disk (not ephemeral container storage).
- **Monitoring** — MinIO exposes Prometheus metrics at `/minio/v2/metrics/cluster`.
- **Backup** — use `mc mirror` (MinIO Client CLI) for bucket replication.

---

## 13. Folder Structure Recap

```
nestjs-minio-upload/
├── docker-compose.yml
├── .env
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── minio/
│   │   ├── minio.module.ts
│   │   └── minio.service.ts        # all MinIO interactions
│   └── upload/
│       ├── upload.module.ts
│       └── upload.controller.ts     # HTTP endpoints
├── package.json
└── tsconfig.json
```

---

## 14. Quick Reference — MinIO SDK Methods You'll Use Most

| Method | Purpose |
|---|---|
| `makeBucket(name)` | Create a bucket |
| `bucketExists(name)` | Check if a bucket exists |
| `putObject(bucket, key, stream, size, meta)` | Upload a file |
| `getObject(bucket, key)` | Download as a stream |
| `presignedGetObject(bucket, key, expiry)` | Generate a temp download URL |
| `presignedPutObject(bucket, key, expiry)` | Generate a temp upload URL (for direct client uploads) |
| `removeObject(bucket, key)` | Delete a file |
| `listObjectsV2(bucket, prefix, recursive)` | List files |
| `statObject(bucket, key)` | Get file metadata without downloading |

---

## 15. Next Steps to Explore

Once the basics are solid, here are things worth learning next:

1. **Direct uploads with presigned PUT URLs** — the client uploads straight to MinIO, bypassing your NestJS server. Great for large files.
2. **Webhook notifications** — MinIO can send events (e.g., "new object created") to your app via webhooks or message queues.
3. **Multipart uploads** — for files over 100 MB, the SDK can split them into parts automatically.
4. **Versioning** — enable bucket versioning to keep a history of every object change.
5. **Lifecycle rules** — auto-delete files after N days (useful for temp uploads).
6. **Integration tests** — spin up MinIO in a test container using `testcontainers` and run real upload/download tests.
