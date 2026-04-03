import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const cookiesMock = vi.fn();
const redirectMock = vi.fn();
const getAuthenticatedUserFromSessionTokenMock = vi.fn();
const listInviteCodesMock = vi.fn();
const listAdminUsersMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: cookiesMock
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUserFromSessionToken: getAuthenticatedUserFromSessionTokenMock,
  resolveSessionCookieName: () => "atlas_session"
}));

vi.mock("@/lib/admin", () => ({
  isAdminUsername: (username: string) => username === "atlas01"
}));

vi.mock("@/lib/invite-codes", () => ({
  listInviteCodes: listInviteCodesMock
}));

vi.mock("@/lib/auth-db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-db")>("@/lib/auth-db");
  return {
    ...actual,
    listAdminUsers: listAdminUsersMock
  };
});

describe("admin page", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    redirectMock.mockReset();
    getAuthenticatedUserFromSessionTokenMock.mockReset();
    listInviteCodesMock.mockReset();
    listAdminUsersMock.mockReset();
    vi.restoreAllMocks();
  });

  test("redirects unauthenticated visitors to login", async () => {
    cookiesMock.mockResolvedValue({
      get: () => undefined
    });
    getAuthenticatedUserFromSessionTokenMock.mockReturnValue(null);
    const { default: AdminPage } = await import("@/app/admin/page");

    await AdminPage();

    expect(redirectMock).toHaveBeenCalledWith("/login?returnTo=%2Fadmin");
  });

  test("renders invite codes and users for an admin", async () => {
    cookiesMock.mockResolvedValue({
      get: () => ({ value: "session-token" })
    });
    getAuthenticatedUserFromSessionTokenMock.mockReturnValue({
      username: "atlas01",
      displayName: "Atlas Admin"
    });
    listInviteCodesMock.mockReturnValue([
      {
        id: "invite-1",
        code: "ATLAS-AB12-CD34",
        status: "active",
        createdAt: "2026-04-03T06:00:00.000Z",
        createdBy: "atlas01",
        usedAt: null,
        usedByUserId: null,
        usedByUsername: null
      }
    ]);
    listAdminUsersMock.mockReturnValue([
      {
        id: "user-1",
        username: "atlas01",
        displayName: "Atlas Admin",
        status: "active",
        createdAt: "2026-04-03T05:00:00.000Z",
        lastLoginAt: "2026-04-03T06:10:00.000Z"
      }
    ]);
    const { default: AdminPage } = await import("@/app/admin/page");

    render(await AdminPage());

    expect(screen.getByText("邀请码管理")).toBeInTheDocument();
    expect(screen.getByText("ATLAS-AB12-CD34")).toBeInTheDocument();
    expect(screen.getByText("Atlas Admin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成 20 个邀请码" })).toBeInTheDocument();
  });

  test("generates invite codes in-page and copies a code", async () => {
    cookiesMock.mockResolvedValue({
      get: () => ({ value: "session-token" })
    });
    getAuthenticatedUserFromSessionTokenMock.mockReturnValue({
      username: "atlas01",
      displayName: "Atlas Admin"
    });
    listInviteCodesMock.mockReturnValue([
      {
        id: "invite-1",
        code: "ATLAS-AB12-CD34",
        status: "active",
        createdAt: "2026-04-03T06:00:00.000Z",
        createdBy: "atlas01",
        usedAt: null,
        usedByUserId: null,
        usedByUsername: null
      }
    ]);
    listAdminUsersMock.mockReturnValue([
      {
        id: "user-1",
        username: "atlas01",
        displayName: "Atlas Admin",
        status: "active",
        createdAt: "2026-04-03T05:00:00.000Z",
        lastLoginAt: "2026-04-03T06:10:00.000Z"
      }
    ]);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/admin/invite-codes" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            inviteCodes: [
              {
                id: "invite-2",
                code: "ATLAS-EF56-GH78",
                status: "active",
                createdAt: "2026-04-03T06:20:00.000Z",
                createdBy: "atlas01",
                usedAt: null,
                usedByUserId: null,
                usedByUsername: null
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      throw new Error(`unexpected fetch: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const clipboardWriteTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText: clipboardWriteTextMock },
      configurable: true
    });
    const { default: AdminPage } = await import("@/app/admin/page");

    render(await AdminPage());

    fireEvent.click(screen.getByRole("button", { name: "生成 20 个邀请码" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/invite-codes",
        expect.objectContaining({ method: "POST" })
      );
    });
    expect(await screen.findByText("ATLAS-EF56-GH78")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "复制 ATLAS-EF56-GH78" }));

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith("ATLAS-EF56-GH78");
    });
    expect(await screen.findByText("已复制")).toBeInTheDocument();
  });
});
