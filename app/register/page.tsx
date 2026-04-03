"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          username,
          displayName,
          inviteCode,
          password
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error || "注册失败，请稍后重试。");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("注册失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-stage">
        <div className="login-hero">
          <div className="login-hero-panel">
            <p className="eyebrow">Pin2pin Atlas</p>
            <h1>创建账号，直接进入 Atlas</h1>
            <p className="login-lead">注册完成后会自动登录，直接进入 datasheet 分析工作区。</p>
            <div className="login-hero-points" aria-hidden="true">
              <span>Upload PDF</span>
              <span>Evidence</span>
              <span>Follow-up</span>
            </div>
          </div>
        </div>

        <section className="login-card">
          <div className="login-copy">
            <p className="eyebrow">Pin2pin Atlas</p>
            <h1>注册</h1>
            <p>输入邀请码，创建用户名和密码，注册后会自动进入产品。</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label>
              <span>用户名</span>
              <input
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            <label>
              <span>显示名称</span>
              <input
                name="displayName"
                autoComplete="nickname"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
            <label>
              <span>邀请码</span>
              <input
                name="inviteCode"
                autoComplete="off"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
              />
            </label>
            <label>
              <span>密码</span>
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error ? <p className="login-error">{error}</p> : null}
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "注册中..." : "注册并进入"}
            </button>
          </form>

          <p className="login-switch-copy">
            已有账号？
            {" "}
            <a href="/login">去登录</a>
          </p>
        </section>
      </section>
    </main>
  );
}
