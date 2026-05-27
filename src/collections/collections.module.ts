import { Module } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { CollectionsController } from './collections.controller';
import { MinioModule } from 'src/minio/minio.module';

@Module({
  providers: [CollectionsService],
  controllers: [CollectionsController],
  imports: [MinioModule],
})
export class CollectionsModule {}
