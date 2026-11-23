/** Time left at the current speed as m:ss, or `--:--` when the speed is zero. */
export function formatTimeLeft(remainingLines: number, linesPerSecond: number): string {
  if (linesPerSecond <= 0) return '--:--';
  const seconds = Math.round(remainingLines / linesPerSecond);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
