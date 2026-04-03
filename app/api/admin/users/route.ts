import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth";
import { isAdminUsername } from "@/lib/admin";
import { listAdminUsers } from "@/lib/auth-db";

export async function GET(request: Request) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isAdminUsername(user.username)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ users: listAdminUsers() });
}
