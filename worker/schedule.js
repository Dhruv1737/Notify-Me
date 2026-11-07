
export function nextCheckTime(intervalMinutes, from = new Date()) {
  const base = intervalMinutes * 60 * 1000;
  const jitter = Math.floor(Math.random() * base * 0.1);
  return new Date(from.getTime() + base + jitter);
}