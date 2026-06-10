const BASE = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`API ${r.status}: ${body}`);
  }
  return r.json();
}

export const api = {
  health: () => req<{
    status: string;
    live_mode: boolean;
    missing_config: string[];
    ws_clients: number;
    stats: Record<string, number>;
  }>('/health'),

  summaryStats: () => req<import('./types').SummaryStats>('/api/stats/summary'),
  txHistory:    (limit = 50) => req<{ transactions: import('./types').TxRecord[] }>(`/api/stats/history?limit=${limit}`),
  price:        (tokenIn = 'RES', tokenOut = 'OLV') => req<import('./types').PriceData>(`/api/dex/price?token_in=${tokenIn}&token_out=${tokenOut}`),

  swap: (body: { token_in: string; token_out: string; amount_in: number; sender?: string }) =>
    req('/api/dex/swap', { method: 'POST', body: JSON.stringify(body) }),

  manualAttack: () => req('/api/attack/manual', { method: 'POST' }),
  autoAttack:   (enabled: boolean, interval = 10) =>
    req('/api/attack/auto', { method: 'POST', body: JSON.stringify({ enabled, interval_seconds: interval }) }),
  attackStatus: () => req<{ auto_running: boolean; configured: boolean; missing_config: string[] }>('/api/attack/status'),

  events:       (limit = 100) => req<{ events: import('./types').EventRecord[] }>(`/api/events/?limit=${limit}`),
  replayEvents: (startTs: number, endTs: number) =>
    req<{ events: import('./types').EventRecord[] }>(`/api/events/replay?start_ts=${startTs}&end_ts=${endTs}`),
};
