import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DocumentFileType, Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { DocumentStatus } from './enums/document-status.dto';
import { MinioService } from 'src/minio/minio.service';
import { mimeToFileType } from './utils/file-type.util';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JOBS, QUEUE } from './constants';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly minioService: MinioService,
    @InjectQueue(QUEUE.DOCUMENT_PROCESSING)
    private readonly convertDocToEmbeddedVectorQueue: Queue,
  ) {}

  private async uploadDocumentToMinioBucket(
    buffer: Buffer,
    s3key: string,
    fileSize: number,
    fileMimeType: string,
    fileOriginalName: string,
  ) {
    try {
      const uploadResult: { objectName: string; etag: string } =
        await this.minioService.uploadFile(
          buffer,
          s3key,
          fileSize,
          fileMimeType,
          { 'X-Original-Name': fileOriginalName },
        );
      this.logger.log(
        `From documentService => document successfully uploaded to minio- etag ${uploadResult.etag}`,
      );
    } catch (error) {
      this.logger.error(`Minio upload failed: ${error.message}`);
      throw new InternalServerErrorException(
        'File upload failed. Please try again.',
      );
    }
  }

  async uploadDocumentToMinioAndDatabase(
    userId: string,
    file: Express.Multer.File,
    collectionId?: string,
  ) {
    // determine the file type from MIME, placed up here to know if it's an allowed type
    const fileType = mimeToFileType(file.mimetype);

    const documentCount = await this.prismaService.document.count({
      where: { userId },
    });
    if (documentCount >= 50) {
      throw new BadRequestException(
        'Document limit reached. You can only store a maximum of 50 documents.',
      );
    }

    /** To PREVENT the user from uploading the same document to a collection by hashing the incoming document's buffer and
     comparing it against the user's stored document's buffer */
    const checkSumHash = createHash('sha256').update(file.buffer).digest('hex');

    await this.documentExists(userId, checkSumHash, collectionId);

    // build a unique S3 key
    const fileExtension = file.originalname.split('.').pop() || 'bin';
    const s3key = `users/${userId}/documents/${uuidv4()}.${fileExtension}`;

    // upload to minIO
    await this.uploadDocumentToMinioBucket(
      file.buffer,
      s3key,
      file.size,
      file.mimetype,
      file.originalname,
    );

    // resolve collection- find/create 'General' collection if the user didn't specify
    let resolvedCollectionId: string;
    try {
      resolvedCollectionId = await this.resolveCollection(userId, collectionId);
    } catch (error) {
      // DELETE the orphaned file from MinIO if we're unable to retrieve a collectionId
      await this.minioService.deleteFile(s3key).catch((cleanUpErr) => {
        this.logger.warn(
          `Failed to clean up orphaned file- ${s3key}, \n error-message: ${cleanUpErr.message}`,
        );
      });
      this.logger.error(
        `Collection resolution failed: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to resolve document collection.',
      );
    }

    const document = await this.createDocument(
      file.originalname,
      fileType,
      file.size,
      s3key,
      checkSumHash,
      userId,
      resolvedCollectionId,
    );

    // generate download URL
    const downloadUrl = await this.minioService.getPresignedUrl(s3key);
    this.logger.log(
      `Document uploaded successfully: ${document.id} (${file.originalname}) for user ${userId}`,
    );
    await this.downloadDocToEmbVector_Job(userId, document.id, document.s3_key);

    return {
      message: 'File uploaded successfully',
      document: {
        id: document.id,
        originalFilename: document.original_filename,
        fileType: document.file_type,
        s3Key: document.s3_key,
        status: document.status,
        collectionId: resolvedCollectionId,
        downloadUrl,
      },
    };
  }

  async createDocument(
    originalFilename: string,
    fileType: DocumentFileType,
    fileSizeBytes: number,
    s3key: string,
    checkSumHash: string,
    userId: string,
    resolvedCollectionId: string,
  ) {
    try {
      const document = await this.prismaService.document.create({
        data: {
          original_filename: originalFilename,
          file_type: fileType,
          file_size_bytes: fileSizeBytes,
          s3_key: s3key,
          checkSum: checkSumHash,
          status: DocumentStatus.PENDING,
          user: {
            connect: { id: userId },
          },
          collection: {
            connect: { id: resolvedCollectionId },
          },
        },
        select: {
          id: true,
          original_filename: true,
          file_type: true,
          s3_key: true,
          status: true,
        },
      });

      return {
        id: document.id,
        original_filename: document.original_filename,
        file_type: document.file_type,
        s3_key: document.s3_key,
        status: document.status,
        collectionId: resolvedCollectionId,
      };
    } catch (error) {
      // delete the orphaned file from MinIO
      await this.minioService.deleteFile(s3key).catch((cleanUpErr) => {
        this.logger.warn(
          `Failed to clean up orphaned file- ${s3key}, \n error-message: ${cleanUpErr.message}`,
        );
      });
      this.logger.error(
        `Document record creation failed: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to save the document record. The uploaded file to minio has been deleted.',
      );
    }
  }

  async documentExists(
    userId: string,
    checkSumHash: string,
    collectionId?: string,
  ): Promise<void> {
    // determine which collection to check against
    const targetCollectionId =
      collectionId ??
      (
        await this.prismaService.collection.findFirst({
          where: { name: 'General', userId: userId },
          select: { id: true },
        })
      )?.id;

    // if no target collection exists yet, there can't be a duplicate file
    if (!targetCollectionId) return;

    const allUserDocuments = await this.prismaService.document.count({
      where: { id: userId },
    });
    this.logger.log(`number of user documents: ${allUserDocuments}`);

    const existing = await this.prismaService.document.findFirst({
      where: {
        userId,
        checkSum: checkSumHash,
        collectionId: targetCollectionId,
      },
      select: { original_filename: true },
    });
    if (existing) {
      throw new BadRequestException(
        `This file has already been uploaded as "${existing.original_filename}".`,
      );
    }
  }

  // NOTE OPTIMIZE this function like you did with documentExists()
  private async resolveCollection(
    userId: string,
    collectionId?: string,
  ): Promise<string> {
    if (collectionId) {
      // verify the collectionId belongs to the user
      const collection = await this.prismaService.collection.findFirst({
        where: { id: collectionId, userId },
      });
      if (!collection) {
        // the collection doesn't exist for the user
        throw new BadRequestException(
          'Collection not found or does not belong to your account...',
        );
      }
      return collection.id;
    }

    // scenario where collectionId wasn't provided
    const generalName = 'General';
    // upsert style- find or create
    let general = await this.prismaService.collection.findFirst({
      where: { name: generalName, userId },
    });
    if (!general) {
      general = await this.prismaService.collection.create({
        data: {
          name: generalName,
          userId,
        },
      });
      this.logger.log(`Created 'General' collection for user ${userId}`);
    }
    return general.id;
  }

  /** receives a presigned url to retrieve a document.
   It verifies if the requesting user owns the document. */
  async getDocumentDownloadUrl(
    userId: string,
    documentId: string,
  ): Promise<{ downloadUrl: string }> {
    const document = await this.prismaService.document.findFirst({
      where: { id: documentId, userId: userId },
    });
    if (!document) throw new BadRequestException('Document not found.');

    const downloadUrl = await this.minioService.getPresignedUrl(
      document.s3_key,
    );
    return { downloadUrl };
  }

  async listDocuments(userId: string, collectionId?: string) {
    const where: Prisma.DocumentWhereInput = { userId };
    if (collectionId) {
      where.collectionId = collectionId;
      this.logger.log(`where-> ${JSON.stringify(where)}`);
    }

    const documents = await this.prismaService.document.findMany({
      where,
      select: {
        id: true,
        original_filename: true,
        file_type: true,
        file_size_bytes: true,
        status: true,
        createdAt: true,
        collectionId: true,
        checkSum: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { count: documents.length, documents };
  }

  //  delete the document from both minIO and prisma db
  async deleteDocument(userId: string, documentId: string): Promise<void> {
    const document = await this.prismaService.document.findFirst({
      where: { id: documentId, userId },
    });
    if (!document) throw new BadRequestException('Document not found..');

    // delete from minIO first, if it fails do NOT delete from the database.
    try {
      await this.minioService.deleteFile(document.s3_key);
    } catch (error) {
      this.logger.error(
        `Failed to delete document from the minIO bucket: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to save document record. The uploaded file has been cleaned up.',
      );
    }

    await this.prismaService.document.delete({ where: { id: documentId } });
    this.logger.log(
      `Successfully deleted the document- ${documentId} from both the database and the minio bucket.  From user- ${userId}`,
    );
  }

  async deleteManyDocuments(
    userId: string,
    documentIds?: string[],
  ): Promise<void> {
    const where: Prisma.DocumentWhereInput = { userId };
    if (documentIds?.length) {
      where.id = { in: documentIds }; // add a where.id key to the where dictionary
    }

    const documents = await this.prismaService.document.findMany({
      where,
      select: { id: true, s3_key: true },
    });

    if (!documents?.length) {
      throw new BadRequestException(
        documentIds?.length
          ? 'None of the specified documents were found.' // if .length
          : 'No documents found for this user.',
      );
    }

    // delete from minIO first
    const failedDeletes: string[] = [];
    await Promise.all(
      documents.map((doc) =>
        this.minioService.deleteFile(doc.s3_key).catch((err) => {
          failedDeletes.push(doc.id);
          this.logger.warn(
            `Failed to delete document- ${doc.s3_key} from the minIO bucket: ${err.message}`,
          );
        }),
      ),
    );

    // Only delete DB records for files successfully removed from MinIO
    const successfulIds: string[] = documents
      .filter((doc) => !failedDeletes.includes(doc.id))
      .map((doc) => doc.id);

    if (successfulIds.length) {
      await this.prismaService.document.deleteMany({
        where: { id: { in: successfulIds } },
      });
    }

    this.logger.log(
      `Deleted ${successfulIds.length}/${documents.length} documents for user ${userId}`,
    );

    if (failedDeletes.length) {
      throw new InternalServerErrorException(
        `${failedDeletes.length} document(s) failed to delete from storage.`,
      );
    }
  }

  async downloadDocToEmbVector_Job(
    userId: string,
    documentId: string,
    s3key: string,
  ) {
    //  add a job to the queue
    await this.convertDocToEmbeddedVectorQueue.add(
      // name of the job to allow you to create specialized consumers that will only process jobs with a given name.
      JOBS.DownloadExtractChunkAndEmbedDocument,
      { documentId: documentId, s3key: s3key },
      {
        delay: 3000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );
    this.logger.log({
      message: `Document ${documentId} processing added to Job- ${JOBS.DownloadExtractChunkAndEmbedDocument}...`,
    });
  }

  async countAllChunks() {
    const deleteChunks = await this.prismaService.chunk.deleteMany({});
    this.logger.log(`deleted all chunks `);
    return await this.prismaService.chunk.count();
  }
}
