const requestMap = new Map<string, number[]>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 5;

export function checkRateLimit(address: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const timestamps = requestMap.get(address) || [];

  const recent = timestamps.filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    const oldest = recent[0];
    const retryAfterSeconds = Math.ceil(
      (oldest + WINDOW_MS - now) / 1000
    );
    return { allowed: false, retryAfterSeconds };
  }

  recent.push(now);
  requestMap.set(address, recent);
  return { allowed: true, retryAfterSeconds: 0 };
}
