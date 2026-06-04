import { Module } from '@nestjs/common';
import { QueryCacheService } from './query-cache.service';

@Module({
  providers: [QueryCacheService],
  exports: [QueryCacheService],
})
export class QueryCacheModule {}
