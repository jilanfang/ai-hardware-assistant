import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Workspace } from "@/components/workspace";
import { getAuthenticatedUserFromSessionToken, resolveSessionCookieName } from "@/lib/auth";

export default async function HomePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(resolveSessionCookieName())?.value ?? null;
  const currentUser = getAuthenticatedUserFromSessionToken(sessionToken);

  if (!currentUser) {
    redirect("/login?returnTo=%2F");
  }

  return <Workspace currentUser={{ username: currentUser.username, displayName: currentUser.displayName }} />;
}
