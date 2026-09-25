import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { StatementParseError } from '../parsing/csv-statement.parser';

/** A file we cannot read is the user's problem to fix, so answer 422 with the parser's message. */
@Catch(StatementParseError)
export class ParseErrorFilter implements ExceptionFilter {
  catch(error: StatementParseError, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.UNPROCESSABLE_ENTITY)
      .json({ statusCode: HttpStatus.UNPROCESSABLE_ENTITY, message: error.message });
  }
}
