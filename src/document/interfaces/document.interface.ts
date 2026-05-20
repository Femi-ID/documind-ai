import { DocumentFileType, DocumentStatus } from 'src/generated/prisma/enums';

// Both interfaces CreateDocumentData and UploadDocumentResult not needed/used atm
export interface CreateDocumentData {
  collectionId?: string;
  originalFilename: string;
  fileType: DocumentFileType; // enum value
  fileSizeBytes: number;
  s3Key: string;
  checkSum: string;
  status: DocumentStatus;
}

export interface UploadDocumentResult {
  message: string;
  document: {
    id: string;
    originalFilename: string;
    fileType: string;
    fileSizeBytes: number;
    s3Key: string;
    status: string;
    collectionId: string;
    downloadUrl: string;
  };
}

export interface TextChunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
  startCharOffset: number;
  endCharOffset: number;
}

export interface DocumentProcessingJobData {
  userId: string;
  documentId: string;
  s3key: string;
}
