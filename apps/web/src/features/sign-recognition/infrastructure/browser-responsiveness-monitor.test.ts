import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RecognitionPerformance } from "../application/recognition-performance";
import { BrowserResponsivenessMonitor } from "./browser-responsiveness-monitor";

let callback: PerformanceObserverCallback;
const disconnect = vi.fn();
const takeRecords = vi.fn(() => []);
class Observer {
  static supportedEntryTypes = ["longtask"];
  constructor(handler: PerformanceObserverCallback) { callback = handler; }
  observe = vi.fn();
  disconnect = disconnect;
  takeRecords = takeRecords;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  vi.stubGlobal("PerformanceObserver", Observer);
  disconnect.mockClear(); takeRecords.mockClear();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function emit(duration: number) {
  callback({ getEntries: () => [{ duration, name: "private-task", attribution: [{ containerSrc: "private-url" }] }] } as unknown as PerformanceObserverEntryList, {} as PerformanceObserver);
}

it("collects bounded numeric responsiveness measurements and disconnects on stop", () => {
  const metrics = new RecognitionPerformance();
  const monitor = new BrowserResponsivenessMonitor(metrics);
  monitor.start();
  vi.advanceTimersByTime(300);
  emit(75);
  expect(metrics.snapshot().responsiveness?.longTasksSupported).toBe(true);
  expect(metrics.snapshot().timings.uiDelayMs?.samples).toBe(3);
  expect(metrics.snapshot().timings.uiLongTaskMs?.p50).toBe(75);
  expect(metrics.snapshot().counters.uiLongTasks).toBe(1);
  expect(JSON.stringify(metrics.snapshot())).not.toContain("private-");
  monitor.stop();
  vi.advanceTimersByTime(100); emit(100);
  expect(metrics.snapshot().counters.uiLongTasks).toBe(1);
  expect(disconnect).toHaveBeenCalledOnce();
});

it("does not confuse unsupported observation with zero long tasks", () => {
  vi.stubGlobal("PerformanceObserver", undefined);
  const metrics = new RecognitionPerformance();
  const monitor = new BrowserResponsivenessMonitor(metrics);
  monitor.start(); vi.advanceTimersByTime(100);
  expect(metrics.snapshot().responsiveness).toEqual({ longTasksSupported: false });
  expect(metrics.snapshot().timings.uiLongTaskMs).toBeUndefined();
  expect(metrics.snapshot().timings.uiDelayMs?.samples).toBe(1);
  monitor.stop();
});

it("discards queued observations after reset and ignores hidden-tab measurements", () => {
  const metrics = new RecognitionPerformance();
  const monitor = new BrowserResponsivenessMonitor(metrics);
  monitor.start();
  metrics.reset(); emit(100);
  expect(metrics.snapshot().counters.uiLongTasks).toBeUndefined();
  vi.advanceTimersByTime(100);
  expect(takeRecords).toHaveBeenCalledOnce();
  emit(60);
  expect(metrics.snapshot().counters.uiLongTasks).toBe(1);
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  vi.advanceTimersByTime(100); emit(150);
  expect(metrics.snapshot().counters.uiLongTasks).toBe(1);
  expect(metrics.snapshot().timings.uiDelayMs).toBeUndefined();
  monitor.stop();
});
