type MetricName =
  | 'api.latency.p50'
  | 'api.latency.p95'
  | 'api.latency.p99'
  | 'llm.extraction.p95'
  | 'geo.query.p95'
  | 'match.candidate_count'
  | 'match.race_conflict_rate'
  | 'credit.update_count'
  | 'sos.trigger_count'
  | 'payment.volume'
  | 'evidence.log_count';

interface MetricPoint {
  name: MetricName;
  value: number;
  tags?: Record<string, string>;
  timestamp?: number;
}

const metricsBuffer: MetricPoint[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

const METRICS_BACKEND = (process.env.NEXT_PUBLIC_METRICS_BACKEND || 'console') as 'console' | 'api';

async function flushToApi(batch: MetricPoint[]): Promise<void> {
  try {
    const origin = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    await fetch(`${origin}/api/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metrics: batch }),
    });
  } catch {
    console.warn('[METRICS] API flush failed, falling back to console');
    console.log('[METRICS]', JSON.stringify(batch));
  }
}

function startFlushLoop(intervalMs = 60000) {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    if (metricsBuffer.length === 0) return;
    const batch = metricsBuffer.splice(0);
    if (METRICS_BACKEND === 'api') {
      flushToApi(batch);
    } else {
      console.log('[METRICS]', JSON.stringify(batch));
    }
  }, intervalMs);
}

export function trackMetric(
  name: MetricName,
  value: number,
  tags?: Record<string, string>,
): void {
  const point: MetricPoint = {
    name,
    value,
    tags,
    timestamp: Date.now(),
  };
  metricsBuffer.push(point);

  if (METRICS_BACKEND === 'console') {
    console.log(`[METRIC] ${name}=${value}`, tags ?? '');
  }
}

startFlushLoop();
