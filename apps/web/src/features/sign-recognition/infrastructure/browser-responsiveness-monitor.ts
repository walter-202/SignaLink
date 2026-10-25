import type { RecognitionPerformance } from "../application/recognition-performance";

/** Session-local numeric aggregates. Does not collect task names, URLs or attribution. */
export class BrowserResponsivenessMonitor {
  private observer: PerformanceObserver | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private supported = false;
  private previousAt = 0;
  private epoch = 0;
  private generation = 0;

  constructor(private readonly metrics: RecognitionPerformance) {}

  start(): void {
    this.stop();
    this.epoch = this.metrics.epoch;
    const generation = this.generation;
    const startedAt = performance.now();
    this.supported = false;
    if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
      try {
        this.observer = new PerformanceObserver((list) => {
          if (this.timer === null || generation !== this.generation || document.hidden || this.epoch !== this.metrics.epoch) return;
          for (const entry of list.getEntries()) {
            if (entry.startTime < startedAt) continue;
            this.metrics.record("uiLongTaskMs", entry.duration);
            this.metrics.increment("uiLongTasks");
          }
        });
        this.observer.observe({ type: "longtask", buffered: false });
        this.supported = true;
      } catch { this.observer?.disconnect(); this.observer = null; }
    }
    this.metrics.setResponsivenessSupport(this.supported);
    this.previousAt = performance.now();
    this.timer = setInterval(this.sample, 100);
    document.addEventListener("visibilitychange", this.visibilityChanged);
  }

  private visibilityChanged = (): void => { this.previousAt = performance.now(); };

  private sample = (): void => {
    const now = performance.now();
    const elapsed = now - this.previousAt;
    this.previousAt = now;
    if (this.timer === null || document.hidden) return;
    if (this.epoch !== this.metrics.epoch) {
      this.epoch = this.metrics.epoch;
      this.observer?.takeRecords();
      this.metrics.setResponsivenessSupport(this.supported);
      return;
    }
    this.metrics.setResponsivenessSupport(this.supported);
    if (elapsed >= 1_000) { this.metrics.increment("uiMeasurementGaps"); return; }
    this.metrics.record("uiDelayMs", Math.max(0, elapsed - 100));
  };

  stop(): void {
    this.generation++;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.observer?.disconnect();
    this.observer = null;
    document.removeEventListener("visibilitychange", this.visibilityChanged);
  }
}
