// Define a type for OpenAI to avoid `any`
import type { OpenAI as OpenAIType } from 'openai';

let OpenAI: typeof OpenAIType | undefined;
try {
  // eslint-disable-next-line global-require, import/extensions, import/no-extraneous-dependencies
  OpenAI = (await import('openai')).default;
} catch {
  // no dependency installed – we will use stubs
}

const apiKey = process.env.OPENAI_API_KEY || '';

export function hasRealOpenAIKey() {
  return Boolean(apiKey && OpenAI);
}

export async function embed(text: string): Promise<number[]> {
  if (hasRealOpenAIKey()) {
    const client = new OpenAI({ apiKey });
    const res = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    // @ts-expect-error – typings vary by version
    return res.data[0].embedding as number[];
  }
  // Fallback: convert chars to small numeric vector (deterministic)
  return Array.from({ length: 8 }, (_, i) =>
    ((text.charCodeAt(i % text.length) || 0) % 100) / 100
  );
}