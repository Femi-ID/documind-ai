import { DocumentFileType, DocumentStatus } from 'src/generated/prisma/enums';

// Both interfaces not needed/used atm
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
