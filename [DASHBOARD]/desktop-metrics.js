// Counter differences, not load averages, drive the live gauges and graph.
// Unknown/reset counters return null so the UI never invents a zero reading.
window.DesktopMetrics = {
  cpu(previous, current) {
    const a = previous?.cpuCounters, b = current?.cpuCounters;
    if (!a || !b || current.uptimeSec <= previous.uptimeSec) return null;
    const total = b.total - a.total, idle = b.idle - a.idle;
    if (!Number.isFinite(total) || !Number.isFinite(idle) || total <= 0 || idle < 0 || idle > total) return null;
    return Math.round(100 * (total - idle) / total);
  },
  network(previous, current, name) {
    const a = previous?.network?.find(n => n.name === name), b = current.network?.find(n => n.name === name);
    const seconds = current.uptimeSec - previous?.uptimeSec;
    if (!a || !b || !Number.isFinite(seconds) || seconds <= 0 || seconds > 30) return null;
    if (![a.rxBytes, b.rxBytes, a.txBytes, b.txBytes].every(Number.isFinite)) return null;
    const down = b.rxBytes - a.rxBytes, up = b.txBytes - a.txBytes;
    return down >= 0 && up >= 0 ? { down: down / seconds, up: up / seconds } : null;
  },
  graph(samples, key, scale) {
    if (!samples.length) return 'M0 84H240';
    return samples.map((p, i) => `${i ? 'L' : 'M'}${(240 * i / Math.max(1, samples.length - 1)).toFixed(1)} ${(84 - Math.min(1, Math.max(0, p[key] / scale)) * 74).toFixed(1)}`).join(' ');
  },
};
