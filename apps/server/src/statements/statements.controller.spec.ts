import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AnalysisResult } from '@expense/shared';
import request from 'supertest';
import { AppModule } from '../app.module';
import { loadConfig } from '../config/configuration';

describe('StatementsController (HTTP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // No API key: the pipeline runs rules only, which keeps the test offline.
    const config = loadConfig({ MAX_UPLOAD_KB: '2', RATE_LIMIT_PER_MINUTE: '100' });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(config)] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('analyzes the sample statement', async () => {
    const res = await request(app.getHttpServer()).post('/api/statements/sample').expect(200);
    const body = res.body as AnalysisResult;
    expect(body.transactions.length).toBeGreaterThan(150);
    expect(body.pipeline.aiStatus).toBe('disabled');
    expect(body.pipeline.byRules + body.pipeline.byAi + body.pipeline.unresolved).toBe(body.transactions.length);
  });

  it('analyzes an uploaded CSV', async () => {
    const csv = 'Date,Description,Amount\n2026-06-01,NETFLIX.COM,-15.49\n2026-06-02,HOLLOWAY BARBERS,-35\n';
    const res = await request(app.getHttpServer())
      .post('/api/statements/analyze')
      .attach('file', Buffer.from(csv), { filename: 'june.csv', contentType: 'text/csv' })
      .expect(200);
    const body = res.body as AnalysisResult;
    expect(body.fileName).toBe('june.csv');
    expect(body.pipeline).toMatchObject({ byRules: 1, unresolved: 1 });
  });

  it('answers 422 with a readable message for a file it cannot parse', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/statements/analyze')
      .attach('file', Buffer.from('hello,world\n'), { filename: 'x.csv', contentType: 'text/csv' })
      .expect(422);
    expect(res.body.message).toMatch(/columns/);
  });

  it('rejects non-CSV files', async () => {
    await request(app.getHttpServer())
      .post('/api/statements/analyze')
      .attach('file', Buffer.from('%PDF-1.4'), { filename: 'statement.pdf', contentType: 'application/pdf' })
      .expect(400);
  });

  it('rejects files over the size limit', async () => {
    await request(app.getHttpServer())
      .post('/api/statements/analyze')
      .attach('file', Buffer.alloc(4 * 1024, 'a'), { filename: 'big.csv', contentType: 'text/csv' })
      .expect(413);
  });

  it('serves the sample as a CSV download', async () => {
    const res = await request(app.getHttpServer()).get('/api/statements/sample.csv').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('SYNTHETIC SAMPLE DATA');
  });
});
