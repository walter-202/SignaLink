export type RecognitionTiming =
  | "modelLoadMs" | "modelDownloadMs" | "modelIntegrityMs" | "modelSessionMs"
  | "landmarkLoadMs" | "landmarkMs" | "featuresMs"
  | "frameIntervalMs" | "observationMs" | "queueMs" | "inferenceMs"
  | "segmentToPredictionMs";

export type RecognitionCounter =
  | "frames" | "accepted" | "uncertain" | "duplicates" | "missingHands"
  | "overloaded" | "stale" | "inferenceErrors" | "frameGaps";

/** Bounded, session-local measurements. Never stores frames, labels or conversation text. */
export class RecognitionPerformance {
  private timings = new Map<RecognitionTiming, { total: number; values: number[] }>();
  private counters: Partial<Record<RecognitionCounter, number>> = {};

  record(name: RecognitionTiming, milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) return;
    const series = this.timings.get(name) ?? { total: 0, values: [] };
    series.total += 1;
    if (series.values.length === 120) series.values.shift();
    series.values.push(milliseconds);
    this.timings.set(name, series);
  }

  increment(name: RecognitionCounter): void {
    this.counters[name] = (this.counters[name] ?? 0) + 1;
  }

  reset(): void {
    this.timings.clear();
    this.counters = {};
  }

  snapshot() {
    const timings = Object.fromEntries([...this.timings].map(([name, series]) => {
      const sorted = [...series.values].sort((a, b) => a - b);
      const percentile = (fraction: number) => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
      return [name, {
        total: series.total,
        samples: sorted.length,
        mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
        p50: percentile(0.5),
        p95: percentile(0.95),
      }];
    })) as Partial<Record<RecognitionTiming, { total: number; samples: number; mean: number; p50: number; p95: number }>>;
    const interval = timings.frameIntervalMs?.mean;
    return {
      schemaVersion: 1,
      pipelineVersion: "continuous-v2",
      sampleLimit: 120,
      processedFps: interval ? 1_000 / interval : null,
      timings,
      counters: { ...this.counters },
    };
  }
}
