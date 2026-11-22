// Local signal heuristic, not speech recognition or a biometric classifier.
// Inspired by the RMS/silence approach reviewed in OpenJarvis speech/voice_io.py.
export class DoubleClap {
  private floor = 0.008;
  private onset: number | null = null;
  private last: number | null = null;
  private blockedUntil = 0;
  feed(rms: number, peak: number, time: number): boolean {
    if (![rms, peak, time].every(Number.isFinite)) return false;
    const threshold = Math.max(0.06, this.floor * 5);
    const loud = rms > threshold && peak > 0.25 && peak / Math.max(rms, 0.001) > 2.2;
    if (time < this.blockedUntil) return false;
    if (loud && this.onset === null) this.onset = time;
    if (!loud && this.onset !== null) {
      const length = time - this.onset;
      const start = this.onset; this.onset = null;
      if (length > 0 && length <= 160) {
        const gap = this.last === null ? 0 : start - this.last;
        if (this.last !== null && gap >= 160 && gap <= 800) {
          this.last = null; this.blockedUntil = time + 2000; return true;
        }
        if (this.last === null || gap > 800) this.last = start;
      } else this.last = null;
    }
    if (rms < threshold / 2) this.floor = Math.max(0.002, Math.min(0.03, this.floor * 0.98 + rms * 0.02));
    return false;
  }
}
