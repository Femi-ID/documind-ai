import { Logger } from '@nestjs/common';
import { DocumentFileType } from 'src/generated/prisma/enums';
import * as mammoth from 'mammoth';
// import * as pdfParse from 'pdf-parse';
import pdfParse from 'pdf-parse';

export class TextExtractionService {
  private readonly logger = new Logger(TextExtractionService.name);

  async extract(
    buffer: Buffer,
    fileType: DocumentFileType,
  ): Promise<{ text: string; pageCount?: number }> {
    switch (fileType) {
      case 'PDF':
        return await this.extractFromPdf(buffer);
        break;
      case 'DOCX':
        return await this.extractFromDocx(buffer);
        break;
      case 'TXT':
        return this.extractFromTxt(buffer);
        break;
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  private async extractFromPdf(buffer: Buffer) {
    const result = await pdfParse(buffer);
    this.logger.log(
      `PDF extracted: ${result.numpages} pages, ${result.text.length} chars`,
    );
    return { text: result.text, pageCount: result.numpages };
  }

  private async extractFromDocx(buffer: Buffer) {
    const result = await mammoth.extractRawText({ buffer });
    if (result.messages.length) {
      this.logger.warn(`Mammoth warnings: ${JSON.stringify(result.messages)}`);
    }
    return { text: result.value };
  }

  extractFromTxt(buffer: Buffer) {
    return { text: buffer.toString('utf-8') };
  }
}
