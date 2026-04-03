import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthenticatedUserFromSessionToken, resolveSessionCookieName } from "@/lib/auth";
import { isAdminUsername } from "@/lib/admin";
import { listAdminUsers } from "@/lib/auth-db";
import { listInviteCodes } from "@/lib/invite-codes";
import { AdminConsole } from "@/app/admin/admin-console";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(resolveSessionCookieName())?.value ?? null;
  const currentUser = getAuthenticatedUserFromSessionToken(sessionToken);

  if (!currentUser) {
    redirect("/login?returnTo=%2Fadmin");
    return null;
  }

  if (!isAdminUsername(currentUser.username)) {
    redirect("/");
    return null;
  }

  const inviteCodes = listInviteCodes();
  const users = listAdminUsers();

  return <AdminConsole currentAdminDisplayName={currentUser.displayName} initialInviteCodes={inviteCodes} users={users} />;
}
