import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { QUEUE } from 'src/document/constants';
import { MessageRole } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE.DOCUMENT_PROCESSING)
    private readonly documentQueue: Queue,
  ) {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST'),
      port: parseInt(String(this.configService.get('REDIS_PORT')), 10),
    });
  }

  async collectMetrics() {
    const [queue, documents, users, conversations, cache] = await Promise.all([
      this.getQueueMetrics(),
      this.getDocumentMetrics(),
      this.getUserMetrics(),
      this.getConversationMetrics(),
      this.getCacheMetrics(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      queue,
      documents,
      users,
      conversations,
      cache,
    };
  }

  //   Queue metrics
  private async getQueueMetrics() {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.documentQueue.getWaitingCount(),
        this.documentQueue.getActiveCount(),
        this.documentQueue.getCompletedCount(),
        this.documentQueue.getFailedCount(),
        this.documentQueue.getDelayedCount(),
      ]);

      return { waiting, active, completed, failed, delayed };
    } catch (error) {
      this.logger.warn(`Failed to collect queue metrics: ${error.message}`);
      return { error: 'unavailable' };
    }
  }

  private async getDocumentMetrics() {
    try {
      const [total, byStatus, totalChunks] = await Promise.all([
        this.prismaService.document.count(), //total document count
        this.prismaService.document.groupBy({
          by: ['status'],
          _count: { id: true },
        }), // documents grouped by processing status
        this.prismaService.chunk.count(), //total chunks across all documents
      ]);

      const statusBreakdown: Record<string, number> = {};
      for (const group of byStatus) {
        statusBreakdown[group.status.toLowerCase()] = group._count.id;
      }

      return { total, statusBreakdown, totalChunks };
    } catch (error) {
      this.logger.warn(`Failed to collect document metrics: ${error.messsage}`);
      return { error: 'unavailable' };
    }
  }

  private async getUserMetrics() {
    try {
      const total = await this.prismaService.user.count();
      return { total };
    } catch (error) {
      this.logger.warn(`Failed to collect user metrics: ${error.message}`);
      return { error: 'unavailable' };
    }
  }

  private async getConversationMetrics() {
    try {
      const [totalConversations, totalMessages, avgLatency] = await Promise.all(
        [
          this.prismaService.conversation.count(),
          this.prismaService.message.count(),

          // Average LLM response latency across all assistant messages
          this.prismaService.message.aggregate({
            where: {
              role: MessageRole.ASSISTANT,
              latencyMs: { not: null, gt: 0 },
            },
            _avg: { latencyMs: true },
            _min: { latencyMs: true },
            _max: { latencyMs: true },
          }),
        ],
      );

      return {
        totalConversations,
        totalMessages,
        llmLatency: {
          avgMs: Math.round(avgLatency._avg.latencyMs || 0),
          minMs: avgLatency._min.latencyMs || 0,
          maxMs: avgLatency._max.latencyMs || 0,
        },
      };
    } catch (error) {
      this.logger.warn(
        `Failed to collect conversation metrics: ${error.message}`,
      );
    }
  }

  private async getCacheMetrics() {
    try {
      // Count all cache keys currently in Redis
      const cacheKeys = await this.scanKeys('qa_cache:*');
      const versionKeys = await this.scanKeys('collection_doc_version:*');

      return {
        cachedAnswers: cacheKeys.length,
        trackedCollections: versionKeys.length,
      };
    } catch (error) {
      this.logger.warn(`Failed to collect cache metrics: ${error.message}`);
      return { error: 'unavailable' };
    }
  }

  /**
   * SCAN-based key counting.
   * Uses SCAN instead of KEYS to avoid blocking Redis on large keyspaces.
   * Fine for metrics collection (runs every 30s at most), but not to be used in a hot request path.
   */
  private async scanKeys(pattern: string) {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, found] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      keys.push(...found);
    } while (cursor !== '0');

    return keys;
  }
}
