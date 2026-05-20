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

@Controller('document')
export class DocumentController {
  private readonly logger = new Logger(DocumentController.name);
  constructor(private readonly documentService: DocumentService) {}

  /**
   * Upload a document. Optionally assign it to a collection.
   * If no collectionId is provided, it goes into the user's "General" collection.
   */
  @HttpCode(HttpStatus.OK)
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

  // Get a presigned download URL for a specific document.
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

  @Get('list')
  async listDocuments(
    @Request() req: UserRequest,
    @Query('collectionId') collectionId?: string,
  ) {
    return this.documentService.listDocuments(req.user.id, collectionId);
  }

  // DELETE a document from both minIO storage and database
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(
    @Request() req: UserRequest,
    @Param('id') documentId: string,
  ) {
    return await this.documentService.deleteDocument(req.user.id, documentId);
  }

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

  @Post('upload-documents')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadManyDocuments(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Request() req: UserRequest,
    @Query('collectionId') collectionId?: string,
  ) {
    console.log(files);
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

  // async createUserDocument(
  //   userId: string,
  //   userDocumentDto: CreateUserDocumentDto,
  // ) {
  //   return await this.documentService.createUserDocument(
  //     userId,
  //     userDocumentDto,
  //   );
  // }

  // @Post('bull-mq/:documentId')
  // async extractText(
  //   @Param('documentId') documentId: string,
  //   @Body() s3key: string,
  // ) {
  //   return this.documentService.downloadDocToEmbVector_Job(documentId, s3key);
  // }

  // for logs only
  @HttpCode(HttpStatus.OK)
  @Get('count-chunks')
  async countAllChunks() {
    return await this.documentService.countAllChunks();
  }
}
