import { resolveSignupRateLimitMaxAttempts, resolveSignupRateLimitWindowMs } from "@/lib/runtime-env";

const attemptsByIp = new Map<string, number[]>();

function now() {
  return Date.now();
}

function activeAttempts(ip: string, currentTime: number) {
  const windowMs = resolveSignupRateLimitWindowMs();
  const timestamps = attemptsByIp.get(ip) ?? [];
  const active = timestamps.filter((timestamp) => currentTime - timestamp < windowMs);
  if (active.length > 0) {
    attemptsByIp.set(ip, active);
  } else {
    attemptsByIp.delete(ip);
  }
  return active;
}

export function recordSignupAttempt(ip: string | null, currentTime = now()) {
  if (!ip) {
    return { limited: false };
  }

  const maxAttempts = resolveSignupRateLimitMaxAttempts();
  const active = activeAttempts(ip, currentTime);
  if (active.length >= maxAttempts) {
    return { limited: true };
  }

  attemptsByIp.set(ip, [...active, currentTime]);
  return { limited: false };
}

export function resetSignupRateLimit() {
  attemptsByIp.clear();
}
