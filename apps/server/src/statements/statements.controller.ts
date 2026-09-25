import {
  BadRequestException,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AnalysisResult } from '@expense/shared';
import { ParseErrorFilter } from './parse-error.filter';
import { StatementsService } from './statements.service';

@Controller('api/statements')
@UseFilters(ParseErrorFilter)
export class StatementsController {
  constructor(private readonly statements: StatementsService) {}

  /** Multipart upload, field name "file". Size is limited by the Multer config in the module. */
  @Post('analyze')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @UseInterceptors(FileInterceptor('file'))
  async analyze(@UploadedFile() file: Express.Multer.File | undefined): Promise<AnalysisResult> {
    if (!file) throw new BadRequestException('Attach a CSV file in the "file" field.');
    const looksLikeCsv = /\.(csv|txt)$/i.test(file.originalname) || /csv|text\/plain/.test(file.mimetype);
    if (!looksLikeCsv) throw new BadRequestException('Only CSV files are supported for now.');
    const text = file.buffer.toString('utf8');
    if (text.includes('\u0000')) throw new BadRequestException('This does not look like a text CSV file.');
    return this.statements.analyze(text, file.originalname);
  }

  @Post('sample')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  analyzeSample(): Promise<AnalysisResult> {
    return this.statements.analyzeSample();
  }

  @Get('sample.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="sample-statement.csv"')
  sampleCsv(): string {
    return this.statements.getSampleCsv();
  }
}
