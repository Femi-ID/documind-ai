import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { MinioModule } from 'src/minio/minio.module';

@Module({
  providers: [DocumentService],
  controllers: [DocumentController],
  imports: [MinioModule],
})
export class DocumentModule {}
