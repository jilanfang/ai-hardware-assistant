import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import LoginPage from "@/app/login/page";
import RegisterPage from "@/app/register/page";

const replaceMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock
  }),
  useSearchParams: () =>
    ({
      get: (key: string) => (key === "returnTo" ? "/" : null)
    })
}));

describe("auth pages", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    refreshMock.mockReset();
  });

  test("login page links to self-service registration", async () => {
    render(<LoginPage />);

    expect(await screen.findByRole("link", { name: "去注册" })).toHaveAttribute("href", "/register");
    expect(screen.getByText("使用你的用户名和密码进入 Atlas。没有账号也可以直接注册。")).toBeInTheDocument();
  });

  test("register page links back to login", () => {
    render(<RegisterPage />);

    expect(screen.getByRole("link", { name: "去登录" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("button", { name: "注册并进入" })).toBeInTheDocument();
    expect(screen.getByLabelText("邀请码")).toBeInTheDocument();
  });
});
