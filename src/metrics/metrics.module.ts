import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE } from 'src/document/constants';

@Module({
  providers: [MetricsService],
  controllers: [MetricsController],
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: QUEUE.DOCUMENT_PROCESSING }),
  ],
})
export class MetricsModule {}
