export function privateResponse(response: Response): Response {
  const result = new Response(response.body, response);
  result.headers.set('cache-control', 'no-store');
  result.headers.set('x-content-type-options', 'nosniff');
  result.headers.set('referrer-policy', 'no-referrer');
  result.headers.set('x-frame-options', 'DENY');
  result.headers.set('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
  return result;
}

export async function boundedRequest(request: Request): Promise<Request | null> {
  const limit = 16 * 1024;
  if (Number(request.headers.get('content-length')) > limit) return null;
  if (!request.body) return request;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Request(request, { body });
}
