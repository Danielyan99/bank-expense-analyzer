import { createAiModel } from '../categorization/ai/create-ai-model';
import { loadConfig } from './configuration';

describe('CORS config', () => {
  it('ignores trailing slashes and spaces pasted with the origin', () => {
    const config = loadConfig({ CORS_ORIGIN: ' https://app.vercel.app/ , http://localhost:5173' });
    expect(config.corsOrigins).toEqual(['https://app.vercel.app', 'http://localhost:5173']);
  });
});

describe('AI provider config', () => {
  it('uses Gemini (free tier) by default', () => {
    const config = loadConfig({ GEMINI_API_KEY: 'g' });
    expect(config.ai).toMatchObject({ provider: 'gemini', model: 'gemini-3.5-flash' });
    expect(createAiModel(config)?.provider).toBe('gemini');
  });

  it('falls back to Claude when only an Anthropic key is set', () => {
    const config = loadConfig({ ANTHROPIC_API_KEY: 'a' });
    expect(config.ai).toMatchObject({ provider: 'claude', model: 'claude-opus-5' });
    expect(createAiModel(config)?.provider).toBe('claude');
  });

  it('respects AI_PROVIDER and AI_MODEL', () => {
    const config = loadConfig({ AI_PROVIDER: 'gemini', AI_MODEL: 'gemini-3.5-flash-lite', GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'a' });
    expect(createAiModel(config)?.model).toBe('gemini-3.5-flash-lite');
  });

  it('runs on rules only when the chosen provider has no key', () => {
    expect(createAiModel(loadConfig({}))).toBeUndefined();
    expect(createAiModel(loadConfig({ AI_PROVIDER: 'claude', GEMINI_API_KEY: 'g' }))).toBeUndefined();
  });

  it('rejects an unknown provider', () => {
    expect(() => loadConfig({ AI_PROVIDER: 'openai' })).toThrow(/must be "gemini" or "claude"/);
  });
});
