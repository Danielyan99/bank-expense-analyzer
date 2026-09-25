import Anthropic from '@anthropic-ai/sdk';
import type { Transaction } from '@expense/shared';
import { loadConfig } from '../config/configuration';
import { AiCategorizerService } from './ai-categorizer.service';

function tx(id: string, merchant: string, amount = -20): Transaction {
  return { id, date: '2026-06-01', description: merchant, merchant, amount, category: 'uncategorized', source: 'none', confidence: 0 };
}

/** Swaps the real Anthropic client for a fake that records requests and returns a canned answer. */
function withFakeClient(results: unknown[] | Error, stopReason = 'end_turn') {
  const service = new AiCategorizerService(loadConfig({ ANTHROPIC_API_KEY: 'test-key' }));
  const parse = jest.fn(async () => {
    if (results instanceof Error) throw results;
    return { stop_reason: stopReason, parsed_output: { results } };
  });
  (service as unknown as { client: unknown }).client = { messages: { parse } };
  return { service, parse };
}

describe('AiCategorizerService', () => {
  it('reports "disabled" and changes nothing without an API key', async () => {
    const service = new AiCategorizerService(loadConfig({}));
    const items = [tx('t1', 'HOLLOWAY BARBERS')];
    const outcome = await service.categorize(items);
    expect(outcome.status).toBe('disabled');
    expect(items[0].source).toBe('none');
  });

  it('sends each merchant once and applies the verdict to every matching transaction', async () => {
    const { service, parse } = withFakeClient([
      { id: 0, category: 'other', confidence: 'high', reason: 'Barber shop, personal care' },
      { id: 1, category: 'dining', confidence: 'medium', reason: 'Sounds like a restaurant' },
    ]);
    const items = [tx('t1', 'HOLLOWAY BARBERS'), tx('t2', 'SAKURA GARDEN'), tx('t3', 'HOLLOWAY BARBERS')];

    const outcome = await service.categorize(items);

    expect(outcome).toMatchObject({ status: 'ok', merchantsSent: 2 });
    expect(parse).toHaveBeenCalledTimes(1);
    expect(items.map((t) => [t.category, t.source])).toEqual([
      ['other', 'ai'],
      ['dining', 'ai'],
      ['other', 'ai'],
    ]);
    expect(items[1]).toMatchObject({ confidence: 0.75, aiReason: 'Sounds like a restaurant' });
  });

  it('sends only description and direction, never amounts or dates', async () => {
    const { service, parse } = withFakeClient([{ id: 0, category: 'transfers', confidence: 'high', reason: 'Person' }]);
    await service.categorize([tx('t1', 'PAYMENT TO 4111 1111 1111 1111', -1234.56)]);

    const request = (parse.mock.calls[0] as unknown[])[0] as { messages: { content: string }[] };
    const content = request.messages[0].content;
    expect(content).toContain('"direction":"money out"');
    expect(content).toContain('####');
    expect(content).not.toContain('1234.56');
    expect(content).not.toContain('2026-06-01');
  });

  it('keeps "unknown" answers uncategorized instead of guessing', async () => {
    const { service } = withFakeClient([{ id: 0, category: 'unknown', confidence: 'low', reason: 'No clue' }]);
    const items = [tx('t1', 'XYZ QPAY LLC')];
    await service.categorize(items);
    expect(items[0]).toMatchObject({ category: 'uncategorized', source: 'none' });
  });

  it('caches verdicts, so a second run makes no API call', async () => {
    const { service, parse } = withFakeClient([{ id: 0, category: 'health', confidence: 'high', reason: 'Dentist' }]);
    await service.categorize([tx('t1', 'DR PATEL DDS')]);
    const again = [tx('t9', 'DR PATEL DDS')];
    const outcome = await service.categorize(again);
    expect(parse).toHaveBeenCalledTimes(1);
    expect(outcome.merchantsSent).toBe(0);
    expect(again[0].category).toBe('health');
  });

  it('turns API failures into an "error" status and leaves transactions untouched', async () => {
    const failure = new Anthropic.RateLimitError(429, undefined, 'rate limited', new Headers());
    const { service } = withFakeClient(failure);
    const items = [tx('t1', 'HOLLOWAY BARBERS')];
    const outcome = await service.categorize(items);
    expect(outcome.status).toBe('error');
    expect(outcome.message).toMatch(/rate-limited/);
    expect(items[0].source).toBe('none');
  });

  it('treats a refusal as an error', async () => {
    const { service } = withFakeClient([], 'refusal');
    const outcome = await service.categorize([tx('t1', 'SOMETHING')]);
    expect(outcome).toMatchObject({ status: 'error', message: 'Claude declined this request.' });
  });
});
