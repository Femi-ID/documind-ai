// import { DocumentFileType } from '../enums/document-file-type.dto';

import { BadRequestException } from '@nestjs/common';
import { DocumentFileType } from 'src/generated/prisma/enums';

const MIME_TO_FILE_TYPE: Record<string, DocumentFileType> = {
  'application/pdf': DocumentFileType.PDF,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    DocumentFileType.DOCX,
  'application/msword': DocumentFileType.DOCX,
  'text/plain': DocumentFileType.TXT,
};

export function mimeToFileType(mime: string): DocumentFileType {
  const fileType = MIME_TO_FILE_TYPE[mime];
  if (!fileType)
    throw new BadRequestException(
      `Unsupported file type: "${mime}". Allowed types: PDF, DOCX, TXT.`,
    );
  return fileType;
}
