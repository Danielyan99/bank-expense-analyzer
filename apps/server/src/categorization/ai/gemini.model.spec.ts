import { ApiError } from '@google/genai';
import { AiModelError } from './ai-model';
import { GeminiModel, parseAnswer } from './gemini.model';

/** Replaces the SDK client with a stub so no network call is made. */
function withResponse(result: unknown | Error) {
  const model = new GeminiModel('test-key', 'gemini-test');
  const generateContent = jest.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  (model as unknown as { client: unknown }).client = { models: { generateContent } };
  return { model, generateContent };
}

const VALID = JSON.stringify({ results: [{ id: 0, category: 'dining', confidence: 'high', reason: 'Pub' }] });

describe('GeminiModel', () => {
  it('asks for JSON with the shared schema and returns the validated answer', async () => {
    const { model, generateContent } = withResponse({ text: VALID, candidates: [{ finishReason: 'STOP' }] });
    const answer = await model.classify('system prompt', 'user prompt');

    expect(answer.results[0]).toEqual({ id: 0, category: 'dining', confidence: 'high', reason: 'Pub' });
    const request = (generateContent.mock.calls[0] as unknown[])[0] as {
      model: string;
      config: { systemInstruction: string; responseMimeType: string; responseJsonSchema: { properties: object } };
    };
    expect(request.model).toBe('gemini-test');
    expect(request.config.systemInstruction).toBe('system prompt');
    expect(request.config.responseMimeType).toBe('application/json');
    expect(request.config.responseJsonSchema.properties).toHaveProperty('results');
    expect(request.config.responseJsonSchema).not.toHaveProperty('$schema');
  });

  it('keeps thinking low for Gemini 3 models', async () => {
    const { model, generateContent } = withResponse({ text: VALID });
    await model.classify('s', 'u');
    const request = (generateContent.mock.calls[0] as unknown[])[0] as { config: { thinkingConfig?: { thinkingLevel: string } } };
    // gemini-test is not a Gemini 3 model, so no thinking config is sent.
    expect(request.config.thinkingConfig).toBeUndefined();

    const three = new GeminiModel('k', 'gemini-3.5-flash');
    const call = jest.fn(async () => ({ text: VALID }));
    (three as unknown as { client: unknown }).client = { models: { generateContent: call } };
    await three.classify('s', 'u');
    expect(((call.mock.calls[0] as unknown[])[0] as { config: object }).config).toMatchObject({
      thinkingConfig: { thinkingLevel: 'LOW' },
    });
  });

  it('retries once when Google answers 5xx', async () => {
    const model = new GeminiModel('k', 'gemini-test');
    const generateContent = jest
      .fn()
      .mockRejectedValueOnce(new ApiError({ message: 'deadline', status: 504 }))
      .mockResolvedValueOnce({ text: VALID });
    (model as unknown as { client: unknown }).client = { models: { generateContent } };
    await expect(model.classify('s', 'u')).resolves.toMatchObject({ results: [{ category: 'dining' }] });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('gives up after the retry fails too', async () => {
    const { model, generateContent } = withResponse(new ApiError({ message: 'deadline', status: 504 }));
    await expect(model.classify('s', 'u')).rejects.toThrow('Gemini API error 504.');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('explains a used-up free quota', async () => {
    const { model } = withResponse(new ApiError({ message: 'quota', status: 429 }));
    await expect(model.classify('s', 'u')).rejects.toThrow('The free AI quota is used up for now. Try again later.');
  });

  it('explains a rejected key', async () => {
    const { model } = withResponse(new ApiError({ message: 'bad key', status: 400 }));
    await expect(model.classify('s', 'u')).rejects.toThrow(/Check the API key/);
  });

  it('treats a blocked prompt as an error', async () => {
    const { model } = withResponse({ text: undefined, promptFeedback: { blockReason: 'SAFETY' } });
    await expect(model.classify('s', 'u')).rejects.toThrow('Gemini declined this request.');
  });
});

describe('parseAnswer', () => {
  it('rejects invalid JSON, schema mismatches and empty answers', () => {
    expect(() => parseAnswer('not json')).toThrow(AiModelError);
    expect(() => parseAnswer('{"results":[{"id":0,"category":"pizza","confidence":"high","reason":"x"}]}')).toThrow(
      /did not match the schema/,
    );
    expect(() => parseAnswer(undefined)).toThrow(/empty answer/);
  });
});
