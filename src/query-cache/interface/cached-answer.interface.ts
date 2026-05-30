export interface CachedAnswer {
  answer: string;
  citations: any[];
  model: string;
  tokenUsage: string;
  latencyMs: string;
  cachedAt: string;
}
