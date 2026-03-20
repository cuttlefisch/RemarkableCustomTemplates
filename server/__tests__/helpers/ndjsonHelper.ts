/**
 * Parse NDJSON response body from app.inject() into an array of typed objects.
 */
export function parseNdjson(body: string): Array<{ type: string; [key: string]: unknown }> {
  return body
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line))
}
