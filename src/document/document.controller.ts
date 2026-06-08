import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Query,
  Request,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { UserRequest } from 'src/auth/types/request.interface';
import { DocumentService } from './document.service';
import { SkipThrottle } from '@nestjs/throttler';
import { CustomThrottlers } from 'src/common/constants/custom-throttlers.constant';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Documents')
@ApiBearerAuth('access-token')
@Controller({ version: '1', path: 'document' })
export class DocumentController {
  private readonly logger = new Logger(DocumentController.name);

  constructor(private readonly documentService: DocumentService) {}

  /**
   * Upload a document. Optionally assign it to a collection.
   * If no collectionId is provided, it goes into the user's "General" collection.
   */
  @SkipThrottle({
    [CustomThrottlers.DEFAULT]: true, // this bypasses the global DEFAULT throttler
    [CustomThrottlers.MODERATE]: false, // wakes up the moderate throttler with the same setting set in app.module.ts
  })
  // @Throttle({ [CustomThrottlers.MODERATE]: { ttl: minutes(1), limit: 20 } }) // 20 requests per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload a document (PDF, DOCX, or TXT)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF, DOCX or TXT file (max 20MB)',
        },
        collectionId: {
          type: 'string',
          format: 'uuid',
          description: 'Optional. Defaults to the user "General collection"',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Document uploaded and queued for processing',
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or size ' })
  @ApiResponse({
    status: 409,
    description: 'Duplicate document (same checkSum)',
  })
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Request() req: UserRequest,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 20 * 1024 * 1024 }), // maxSize <=20mb
          // new FileTypeValidator({ fileType: /pdf|doc|docx|txt$/i }),
          new FileTypeValidator({
            fileType:
              /\/(pdf|msword|vnd\.openxmlformats-officedocuments\.wordprocessingml\.document|plain)$/i,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    // @Query('folder') folder?: string,
    @Query('collectionId') collectionId?: string,
  ) {
    console.log('file sent to the documentService...');
    return await this.documentService.uploadDocumentToMinioAndDatabase(
      req.user.id,
      file,
      collectionId,
    );
  }

  /** Get a presigned download URL for a specific document. */
  @ApiOperation({ summary: 'Get a presigned download URL for a document' })
  @ApiParam({ name: 'id', description: 'Document ID', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Returns presigned URL (1 hour expiry)',
  })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @Get(':id/download-url/')
  async getDDownloadUrl(
    @Request() req: UserRequest,
    @Param('id') documentId: string,
  ) {
    return await this.documentService.getDocumentDownloadUrl(
      req.user.id,
      documentId,
    );
  }

  @ApiOperation({ summary: 'List all documents for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Returns document count and list' })
  @Get('list')
  async listDocuments(
    @Request() req: UserRequest,
    @Query('collectionId') collectionId?: string,
  ) {
    return this.documentService.listDocuments(req.user.id, collectionId);
  }

  /** DELETE a document from both minIO storage and database */
  @ApiOperation({
    summary: 'Delete a single document from both minIO storage and database',
  })
  @ApiParam({ name: 'id', description: 'Document ID', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Document deleted from DB and storage',
  })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(
    @Request() req: UserRequest,
    @Param('id') documentId: string,
  ) {
    return await this.documentService.deleteDocument(req.user.id, documentId);
  }

  @ApiOperation({ summary: 'Delete multiple documents' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        documentIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          description: 'Array of document IDs to delete',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Documents deleted' })
  @Delete('delete/many')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFiles(
    @Request() req: UserRequest,
    @Body('documentIds') documentIds?: string[],
  ) {
    return await this.documentService.deleteManyDocuments(
      req.user.id,
      documentIds,
    );
  }

  @SkipThrottle({
    [CustomThrottlers.DEFAULT]: true, // this bypasses the global DEFAULT throttler
    [CustomThrottlers.MODERATE]: false, // wakes up the MODERATE throttler with the same setting set in app.module.ts
  })
  @ApiOperation({ summary: 'List of documents to upload' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'string',
          format: 'binary',
          description: 'PDF, DOCX or TXT file (max 20MB)',
        },
        collectionId: {
          type: 'string',
          format: 'uuid',
          description: 'Optional. Defaults to the user "General collection"',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Document uploaded and queued for processing',
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or size ' })
  @ApiResponse({
    status: 409,
    description: 'Duplicate document (same checkSum)',
  })
  @Post('upload-documents')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadManyDocuments(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Request() req: UserRequest,
    @Query('collectionId') collectionId?: string,
  ) {
    const results = await Promise.all(
      files.map((file) =>
        this.documentService.uploadDocumentToMinioAndDatabase(
          req.user.id,
          file,
          collectionId,
        ),
      ),
    );
    return results;
  }
}
