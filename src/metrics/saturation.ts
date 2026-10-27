import type { Track } from '../config/release';
import { EmfMetrics, emitMetrics } from './emf';

const MB = 1024 * 1024;

export function sampleSaturation(
  previous: { cpu: NodeJS.CpuUsage; at: number },
  now = { cpu: process.cpuUsage(), at: Date.now() },
  memory = process.memoryUsage(),
): { metrics: EmfMetrics; next: { cpu: NodeJS.CpuUsage; at: number } } {
  const elapsedMs = Math.max(now.at - previous.at, 1);
  const cpuMs = (now.cpu.user - previous.cpu.user + now.cpu.system - previous.cpu.system) / 1000;

  return {
    metrics: {
      ProcessCpu: { value: Math.round((cpuMs / elapsedMs) * 10000) / 100, unit: 'Percent' },
      MemoryRss: { value: Math.round((memory.rss / MB) * 10) / 10, unit: 'Megabytes' },
      HeapUsed: { value: Math.round((memory.heapUsed / MB) * 10) / 10, unit: 'Megabytes' },
    },
    next: now,
  };
}

export function startSaturationSampler(track: Track, intervalMs = 30000): NodeJS.Timeout {
  let previous = { cpu: process.cpuUsage(), at: Date.now() };
  const timer = setInterval(() => {
    const sample = sampleSaturation(previous);
    previous = sample.next;
    emitMetrics(track, sample.metrics);
  }, intervalMs);
  timer.unref();
  return timer;
}
