// // this is a consumer for the extract-text job.
// // A consumer is a class defining methods that either process jobs added into the queue,
// // or listen for events on the queue, or both.

// import { Processor, WorkerHost } from '@nestjs/bullmq';
// import { Logger } from '@nestjs/common';
// import { Job } from 'bullmq';

// @Processor('convertDocToEmbeddedVectorQueue') //name of the queue the class picks jobs from
// export class DownloadDocumentConsumer extends WorkerHost {
//   private readonly logger = new Logger(DownloadDocumentConsumer.name);

//   process(job: Job<any, any, string>): Promise<void> {
//     this.logger.log(job);
//     // await job.updateProgress(23);

//     switch (job.name) {
//       case 'downloadDocFromS3_Job':
//         this.logger.log(
//           `Job's data received in the consumer worker- ${job.data}`,
//         );
//         return this.downloadDocBullMQJob('23', 'femi-id');
//         break;

//       default:
//         this.testBullMQJob();
//         break;
//     }
//     console.log({ message: `Job completed in the consumer` });
//   }

//   downloadDocBullMQJob(id: string, name: string) {
//     console.log({
//       msg: 'hello from downloadDocBullMQJob Consumer...',
//       id: id,
//       name: name,
//     });
//   }

//   testBullMQJob() {
//     return { msg: 'hello from DownloadDoc Consumer...' };
//   }
// }
