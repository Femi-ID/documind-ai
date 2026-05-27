import { HttpException, Injectable, Logger } from '@nestjs/common';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { MinioService } from 'src/minio/minio.service';

@Injectable()
export class CollectionsService {
  private readonly logger = new Logger(CollectionsService.name);
  constructor(
    private readonly prismaService: PrismaService,
    private readonly minioService: MinioService,
  ) {}
  async createCollection(
    userId: string,
    createCollectionDto: CreateCollectionDto,
  ) {
    return await this.prismaService.collection.create({
      data: {
        name: createCollectionDto.name,
        description: createCollectionDto.description ?? '',
        user: { connect: { id: userId } },
      },
    });
  }

  async getCollections(userId: string, collectionId?: string) {
    const targetCollections = collectionId
      ? await this.prismaService.collection.findUnique({
          where: { id: collectionId, userId },
          include: {
            conversations: {
              where: { isActive: true },
              orderBy: { updatedAt: 'desc' },
              select: { id: true, title: true },
            },
          },
        })
      : await this.prismaService.collection.findMany({
          where: { userId },
          select: { id: true, name: true },
          orderBy: { updatedAt: 'desc' }, // starting from the latest first
        });

    return targetCollections;
  }

  async updateCollection(
    userId: string,
    collectionId: string,
    updateCollectionDto: UpdateCollectionDto,
  ) {
    return await this.prismaService.collection.update({
      where: { id: collectionId, userId },
      data: {
        name: updateCollectionDto.name,
        description: updateCollectionDto.description,
      },
    });
  }

  async deleteCollection(userId: string, collectionId: string) {
    // Delete the collection's documents from the minIO bucket and db before deleting the collection
    const documents: { id: string; s3_key: string }[] =
      await this.prismaService.document.findMany({
        where: { collectionId },
        select: { id: true, s3_key: true },
      });

    if (documents?.length) {
      //  delete from minIO first
      const failedDeletedMinioDocs: string[] = [];
      await Promise.all(
        documents.map((doc) =>
          this.minioService.deleteFile(doc.s3_key).catch((err) => {
            failedDeletedMinioDocs.push(doc.id);
            this.logger.warn(
              `Failed to delete document with S3_key- ${doc.s3_key} from minIO bucket: ${err.message}`,
            );
          }),
        ),
      );

      // delete successfully removed minIO documents from the db
      const successfullyDeletedMinioDocs: string[] = documents
        .filter((doc) => !failedDeletedMinioDocs.includes(doc.id))
        .map((doc) => doc.id);

      if (successfullyDeletedMinioDocs.length) {
        await this.prismaService.document.deleteMany({
          where: { id: { in: successfullyDeletedMinioDocs } },
        });
      }
      this.logger.log(
        `Deleted ${successfullyDeletedMinioDocs.length}/${documents.length} documents for user ${userId}`,
      );

      if (failedDeletedMinioDocs.length) {
        throw new Error(
          `${failedDeletedMinioDocs.length} document(s) failed to delete from minIO storage.`,
        );
      }
    } else {
      this.logger.log(
        `No document found in collection- ${collectionId}, DELETING collection immediately.`,
      );
    }

    // delete the collection finally (all these steps cause the doc to collection relationship- onDelete: Restrict)
    return await this.prismaService.collection.delete({
      where: { id: collectionId, userId },
    });
  }
}
