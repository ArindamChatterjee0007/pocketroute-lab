export async function fetchEvidence(url, fetcher = globalThis.fetch) {
  const retries = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetcher(url, { signal: AbortSignal.timeout(30000) });
    if (![502, 503, 504].includes(response.status) || attempt === 3) return { response, retries };
    retries.push({ attempt, status: response.status });
    await response.body?.cancel();
  }
  throw new Error("Evidence retrieval attempts exhausted.");
}