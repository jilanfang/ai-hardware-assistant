import { resolveAdminUsernames } from "@/lib/runtime-env";

export function isAdminUsername(username: string | null | undefined) {
  if (!username) return false;
  return resolveAdminUsernames().includes(username.trim());
}
