import { Injectable } from '@nestjs/common';
import type { AnalysisResult } from '@expense/shared';
import { AiCategorizerService } from '../categorization/ai-categorizer.service';
import { categorizeWithRules } from '../categorization/rule-engine';
import { parseStatementCsv } from '../parsing/csv-statement.parser';
import { generateSampleCsv } from '../sample/sample-statement';

/**
 * The pipeline: parse -> rules -> Claude (leftovers only). Stateless: nothing is stored,
 * the result goes back to the browser and is forgotten.
 */
@Injectable()
export class StatementsService {
  private readonly sampleCsv = generateSampleCsv();

  constructor(private readonly ai: AiCategorizerService) {}

  analyzeSample(): Promise<AnalysisResult> {
    return this.analyze(this.sampleCsv, 'sample-statement.csv');
  }

  getSampleCsv(): string {
    return this.sampleCsv;
  }

  async analyze(csv: string, fileName: string): Promise<AnalysisResult> {
    const t0 = performance.now();
    const parsed = parseStatementCsv(csv);
    const t1 = performance.now();
    const { transactions, unresolved } = categorizeWithRules(parsed.rows);
    const t2 = performance.now();
    const byRules = transactions.length - unresolved.length;

    const outcome = await this.ai.categorize(unresolved.map((i) => transactions[i]));
    const t3 = performance.now();
    const byAi = transactions.filter((t) => t.source === 'ai').length;

    return {
      fileName,
      currency: parsed.currency,
      transactions,
      parse: parsed.report,
      pipeline: {
        byRules,
        byAi,
        unresolved: transactions.length - byRules - byAi,
        merchantsSentToAi: outcome.merchantsSent,
        aiStatus: outcome.status,
        aiModel: outcome.model,
        aiMessage: outcome.message,
        durationMs: { parse: ms(t1 - t0), rules: ms(t2 - t1), ai: ms(t3 - t2) },
      },
    };
  }
}

function ms(value: number): number {
  return Math.round(value * 10) / 10;
}
