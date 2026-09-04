const requestMap = new Map<string, number[]>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function checkRateLimit(
  address: string,
  maxRequests: number = 5
): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const timestamps = requestMap.get(address) || [];

  const recent = timestamps.filter((t) => now - t < WINDOW_MS);

  if (recent.length >= maxRequests) {
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
