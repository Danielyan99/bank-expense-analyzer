import type { Transaction } from '@expense/shared';
import { AiModelError, type AiModel } from './ai/ai-model';
import type { AiAnswer } from './ai/prompt';
import { AiCategorizerService } from './ai-categorizer.service';

function tx(id: string, merchant: string, amount = -20): Transaction {
  return { id, date: '2026-06-01', description: merchant, merchant, amount, category: 'uncategorized', source: 'none', confidence: 0 };
}

/** A fake provider that records prompts and returns a canned answer (or throws). */
function fakeModel(answer: AiAnswer['results'] | Error) {
  const classify = jest.fn(async (_system: string, _user: string): Promise<AiAnswer> => {
    if (answer instanceof Error) throw answer;
    return { results: answer };
  });
  const model: AiModel = { provider: 'gemini', model: 'gemini-test', classify };
  return { service: new AiCategorizerService(model), classify };
}

describe('AiCategorizerService', () => {
  it('reports "disabled" and changes nothing without a provider', async () => {
    const service = new AiCategorizerService(undefined);
    const items = [tx('t1', 'HOLLOWAY BARBERS')];
    const outcome = await service.categorize(items);
    expect(outcome.status).toBe('disabled');
    expect(items[0].source).toBe('none');
  });

  it('sends each merchant once and applies the verdict to every matching transaction', async () => {
    const { service, classify } = fakeModel([
      { id: 0, category: 'other', confidence: 'high', reason: 'Barber shop, personal care' },
      { id: 1, category: 'dining', confidence: 'medium', reason: 'Sounds like a restaurant' },
    ]);
    const items = [tx('t1', 'HOLLOWAY BARBERS'), tx('t2', 'SAKURA GARDEN'), tx('t3', 'HOLLOWAY BARBERS')];

    const outcome = await service.categorize(items);

    expect(outcome).toMatchObject({ status: 'ok', provider: 'gemini', model: 'gemini-test', merchantsSent: 2 });
    expect(classify).toHaveBeenCalledTimes(1);
    expect(items.map((t) => [t.category, t.source])).toEqual([
      ['other', 'ai'],
      ['dining', 'ai'],
      ['other', 'ai'],
    ]);
    expect(items[1]).toMatchObject({ confidence: 0.75, aiReason: 'Sounds like a restaurant' });
  });

  it('sends only description and direction, never amounts or dates', async () => {
    const { service, classify } = fakeModel([{ id: 0, category: 'transfers', confidence: 'high', reason: 'Person' }]);
    await service.categorize([tx('t1', 'PAYMENT TO 4111 1111 1111 1111', -1234.56)]);

    const user = classify.mock.calls[0][1];
    expect(user).toContain('"direction":"money out"');
    expect(user).toContain('####');
    expect(user).not.toContain('1234.56');
    expect(user).not.toContain('2026-06-01');
  });

  it('keeps "unknown" answers uncategorized instead of guessing', async () => {
    const { service } = fakeModel([{ id: 0, category: 'unknown', confidence: 'low', reason: 'No clue' }]);
    const items = [tx('t1', 'XYZ QPAY LLC')];
    await service.categorize(items);
    expect(items[0]).toMatchObject({ category: 'uncategorized', source: 'none' });
  });

  it('caches verdicts, so a second run makes no API call', async () => {
    const { service, classify } = fakeModel([{ id: 0, category: 'health', confidence: 'high', reason: 'Dentist' }]);
    await service.categorize([tx('t1', 'DR PATEL DDS')]);
    const again = [tx('t9', 'DR PATEL DDS')];
    const outcome = await service.categorize(again);
    expect(classify).toHaveBeenCalledTimes(1);
    expect(outcome.merchantsSent).toBe(0);
    expect(again[0].category).toBe('health');
  });

  it('turns provider failures into an "error" status and leaves transactions untouched', async () => {
    const { service } = fakeModel(new AiModelError('The free AI quota is used up for now. Try again later.'));
    const items = [tx('t1', 'HOLLOWAY BARBERS')];
    const outcome = await service.categorize(items);
    expect(outcome).toMatchObject({ status: 'error', message: 'The free AI quota is used up for now. Try again later.' });
    expect(items[0].source).toBe('none');
  });

  it('ignores answers with ids that were never sent', async () => {
    const { service } = fakeModel([{ id: 7, category: 'dining', confidence: 'high', reason: '?' }]);
    const items = [tx('t1', 'SOMETHING')];
    await service.categorize(items);
    expect(items[0].source).toBe('none');
  });
});
