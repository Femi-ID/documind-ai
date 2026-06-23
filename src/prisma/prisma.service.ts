import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'src/generated/prisma/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL as string,
    });
    super({ adapter });

    // const pool = new Pool({
    //   // DOCKER CONFIG
    //   host: process.env.DATABASE_HOST || 'localhost',
    //   port: parseInt(process.env.DATABASE_PORT || '5433'),
    //   database: process.env.DATABASE_NAME || 'docker_documind_db',
    //   user: process.env.DATABASE_USER || 'postgres',
    //   password: process.env.DATABASE_PASSWORD,
    // });

    // const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    let attempts = 0;
    const maxAttempts = 5;
    while (attempts < maxAttempts) {
      try {
        await this.$connect();
        this.logger.log('Connected to the prisma DB');
        return;
      } catch (error) {
        attempts++;
        this.logger.warn(
          `Database connection attempt ${attempts}/${maxAttempts} failed:  ${error.message}`,
        );
        if (attempts >= maxAttempts) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempts));
      }
    }
  }

  async storeChunksWithVectors(
    documentId: string,
    chunks: {
      content: string;
      chunkIndex: number;
      tokenCount: number;
      startCharOffset: number;
      endCharOffset: number;
      embedding: number[];
      pageNumber?: number;
    }[],
  ): Promise<number> {
    // Using a transaction so either ALL chunks are saved or NONE
    // This prevents partial state if something fails mid-insert
    return this.$transaction(async (tx) => {
      let insertedCount = 0;
      for (const chunk of chunks) {
        // Raw SQL because Prisma can't handle the vector type directly
        // The ::vector cast tells pgvector to interpret the array as a vector.
        // the transaction makes it ALL or NOTHING.
        await tx.$executeRaw`
        INSERT INTO "Chunk" ( 
          "id", "documentId", "content", "chunkIndex", "tokenCount", 
          "pageNumber", "startCharOffset", "endCharOffset", "embedding", 
          "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), ${documentId}, ${chunk.content}, ${chunk.chunkIndex}, 
            ${chunk.tokenCount}, ${chunk.pageNumber ?? null}, ${chunk.startCharOffset}, 
            ${chunk.endCharOffset}, ${JSON.stringify(chunk.embedding)}::vector, NOW(), NOW()
            )`;
        insertedCount++;
      }
      return insertedCount;
    });
  }
}
