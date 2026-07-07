/**
 * Parse JSON out of an LLM response. Models wrap JSON in ``` fences (often
 * with a language tag) despite instructions not to — a bare JSON.parse then
 * throws "Unexpected token `" and silently kills the whole extraction
 * pipeline (this broke call summaries + memories in prod for weeks).
 */
export function parseModelJson<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/```\s*$/, '')
    .trim();
  return JSON.parse(cleaned) as T;
}
