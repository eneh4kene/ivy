/**
 * Flatten a nested context object into a flat string map for Retell LLM variables.
 * Nested objects are dot-expanded (e.g. { a: { b: 1 } } → { a_b: "1" }).
 * Arrays are joined as comma-separated strings.
 */
export function flattenContext(ctx: Record<string, any> = {}): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, val] of Object.entries(ctx)) {
    if (val === null || val === undefined) continue;
    if (typeof val === 'object' && !Array.isArray(val)) {
      for (const [k2, v2] of Object.entries(val as object)) {
        if (v2 !== null && v2 !== undefined) flat[`${key}_${k2}`] = String(v2);
      }
    } else if (Array.isArray(val)) {
      flat[key] = val.join(', ');
    } else {
      flat[key] = String(val);
    }
  }
  return flat;
}
