import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CachedAnswer } from './interface/cached-answer.interface';
import { createHash } from 'crypto';

@Injectable()
export class QueryCacheService {
  private readonly logger = new Logger(QueryCacheService.name);
  private readonly redis: Redis;
  private readonly ttlSeconds: number;
  private readonly isEnabled: boolean;

  //   Redis key prefixes
  private readonly CACHE_PREFIX = 'qa_cache';
  private readonly VERSION_PREFIX = 'collection_doc_version';

  constructor(private readonly configService: ConfigService) {
    const password = this.configService.get<string>('REDIS_PASSWORD');
    const useTls = this.configService.get<string>('REDIS_TLS') === 'true';

    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: parseInt(
        String(this.configService.get<number>('REDIS_PORT', 6379)),
        10,
      ),
      password,
      tls: useTls ? {} : undefined, // an empty object enables TLS with default settings
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 100, 5000), // exponential backoff up to 5 secs.
    });

    this.ttlSeconds = parseInt(
      String(this.configService.get<number>('QUERY_CACHE_TTL', 3600)),
      10,
    ); // default- 1hr
    this.isEnabled =
      this.configService.get<string>('QUERY_CACHE_ENABLED', 'true') === 'true'; // kill switch, disable caching without changing code

    this.logger.log(
      `Initialized — enabled: ${this.isEnabled}, TTL: ${this.ttlSeconds}s, TLS: ${useTls}`,
    );
  }

  async onModuleInit() {
    try {
      const pong = await this.redis.ping();
      this.logger.log(`Redis connection verified: ${pong}`);

      // Quick write/read test to confirm operations work
      await this.redis.set('qa_cache:health_check', 'ok', 'EX', 10);
      const check = await this.redis.get('qa_cache:health_check');
      this.logger.log(
        `Redis read/write test: ${check === 'ok' ? 'PASSED' : 'FAILED'}`,
      );
    } catch (error) {
      this.logger.error(`Redis connection FAILED: ${error.message}`);
      this.logger.error(
        'Query caching will not work — all requests will run the full RAG pipeline',
      );
    }
  }

  /**
   * Checks if a cached answer exists for this question + collection.
   *
   * Returns the cached answer if found and the collection version matches,
   * or null if cache miss (no entry, or version mismatch via key structure).
   */
  async getCachedAnswer(
    collectionId: string,
    question: string,
  ): Promise<CachedAnswer | null> {
    if (!this.isEnabled) {
      this.logger.log('Cache is DISABLED via env — skipping');
      return null;
    }

    try {
      const cacheKey = await this.buildCacheKey(collectionId, question);
      this.logger.log(`LOOKUP - key: ${cacheKey}`);
      const cached = await this.redis.get(cacheKey);

      if (!cached) {
        this.logger.log(`Cache MISS for collection: ${collectionId}`);
        return null;
      }

      this.logger.log(`Cache HIT for collection: ${collectionId}`);
      return JSON.parse(cached) as CachedAnswer;
    } catch (error) {
      // the cache error MUST not break the RAG pipeline, if redis is down skip and continue the full pipeline.
      this.logger.error(`Cache read FAILED: ${error.message}`);
      return null;
    }
  }

  /** Store AI answer in the cache after successful RAG pipeline run. */
  async cacheAnswer(
    collectionId: string,
    question: string,
    answer: CachedAnswer,
  ): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const cacheKey = await this.buildCacheKey(collectionId, question);
      answer.cachedAt = new Date().toISOString(); //override it to user current date

      // await this.redis.setex(cacheKey, this.ttlSeconds, JSON.stringify(answer));
      await this.redis.set(
        cacheKey,
        JSON.stringify(answer),
        'EX',
        this.ttlSeconds,
      );

      this.logger.log(
        `CACHED answer for collection ${collectionId} (TTL: ${this.ttlSeconds}s)`,
      );
    } catch (error) {
      this.logger.warn(`Cache write failed: ${error.message}`);
    }
  }

  /**
   * Increment the doc version for a collection.
   *
   * Call this when:
   * - A document finishes processing (status → COMPLETED) in that collection
   * - A document is deleted from that collection
   *
   * After incrementing, all existing cache keys for this collection become
   * unreachable (they contain the old version number) and will expire via TTL.
   */
  async invalidateCollection(collectionId: string): Promise<void> {
    try {
      const versionKey = `${this.VERSION_PREFIX}:${collectionId}`;
      const newVersion = await this.redis.incr(versionKey);

      this.logger.log(
        `INVALIDATED cache for collection ${collectionId} (new doc_version: ${newVersion})`,
      );
    } catch (error) {
      this.logger.warn(`Cache invalidation FAILED: ${error.message}`);
    }
  }

  /**
   * Build the full cache key: qa_cache:{collectionId}:v{version}:{questionHash}
   * The version is fetched from Redis on every read. If no version exists
   * (first time this collection is seen), it defaults to 0.
   */
  private async buildCacheKey(
    collectionId: string,
    question: string,
  ): Promise<string> {
    const version = await this.getDocVersion(collectionId);
    const questionHash = this.hashQuestion(question);

    return `${this.CACHE_PREFIX}:${collectionId}:v${version}:${questionHash}`;
  }

  /**Get the current doc version for a collection. Returns '0' if no version exists (no doc has been processed yet. */
  private async getDocVersion(collectionId: string): Promise<string> {
    const versionKey = `${this.VERSION_PREFIX}:${collectionId}`;
    const version = await this.redis.get(versionKey);
    return version || '0';
  }

  /**
   * Normalize and hash the question for consistent cache key generation.
   *
   * Normalization ensures minor variations in how the same question is typed
   * still hit the cache:
   * - "What is AI?" → "what is ai?"
   * - "  What  is   AI?  " → "what is ai?"
   *
   * SHA-256 produces a fixed-length key regardless of question length,
   * keeping Redis memory predictable.
   */
  private hashQuestion(question: string): string {
    const normalized = question.toLowerCase().trim().replace(/\s+/g, ' ');
    return createHash('sha256').update(normalized).digest('hex');
  }
}
