"use client";

import React, { useState } from "react";

import type { InviteCodeRecord, AdminUserRecord } from "@/lib/auth-db";

type AdminConsoleProps = {
  currentAdminDisplayName: string;
  initialInviteCodes: InviteCodeRecord[];
  users: AdminUserRecord[];
};

export function AdminConsole({ currentAdminDisplayName, initialInviteCodes, users }: AdminConsoleProps) {
  const [inviteCodes, setInviteCodes] = useState(initialInviteCodes);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [copiedCode, setCopiedCode] = useState("");

  async function handleGenerateInviteCodes() {
    setIsGenerating(true);
    setGenerationError("");

    try {
      const response = await fetch("/api/admin/invite-codes", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        }
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setGenerationError(payload?.error || "生成邀请码失败，请稍后重试。");
        return;
      }

      const payload = (await response.json()) as { inviteCodes?: InviteCodeRecord[] };
      const createdCodes = payload.inviteCodes ?? [];
      setInviteCodes((current) => [...createdCodes, ...current]);
      setCopiedCode("");
    } catch {
      setGenerationError("生成邀请码失败，请稍后重试。");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopyInviteCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
    } catch {
      setGenerationError("复制失败，请手动复制邀请码。");
    }
  }

  return (
    <main className="admin-shell">
      <section className="admin-stage">
        <div className="admin-header-card">
          <div className="admin-header-copy">
            <p className="eyebrow">Pin2pin Atlas</p>
            <h1>邀请码管理</h1>
            <p>当前管理员：{currentAdminDisplayName}</p>
          </div>
          <div className="admin-header-actions">
            <button type="button" className="admin-primary-button" onClick={handleGenerateInviteCodes} disabled={isGenerating}>
              {isGenerating ? "生成中..." : "生成 20 个邀请码"}
            </button>
            <p className="admin-inline-note">邀请码为单次码。注册成功后会自动变为 `used`。</p>
          </div>
        </div>

        {generationError ? <p className="admin-error-banner">{generationError}</p> : null}

        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>邀请码</h2>
              <p>用于私测注册。明文展示，方便复制给受邀用户。</p>
            </div>
            <span className="admin-pill">{inviteCodes.length} 条</span>
          </div>

          {inviteCodes.length === 0 ? (
            <p className="admin-empty-state">当前还没有邀请码。先生成一批 20 个单次邀请码。</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>状态</th>
                    <th>创建时间</th>
                    <th>使用时间</th>
                    <th>注册用户</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {inviteCodes.map((inviteCode) => {
                    const isCopied = copiedCode === inviteCode.code;
                    return (
                      <tr key={inviteCode.id}>
                        <td className="admin-code-cell">
                          <code>{inviteCode.code}</code>
                        </td>
                        <td>
                          <span className={`admin-status-chip is-${inviteCode.status}`}>{inviteCode.status}</span>
                        </td>
                        <td>{inviteCode.createdAt}</td>
                        <td>{inviteCode.usedAt ?? "-"}</td>
                        <td>{inviteCode.usedByUsername ?? "-"}</td>
                        <td>
                          <button
                            type="button"
                            className="admin-copy-button"
                            onClick={() => handleCopyInviteCode(inviteCode.code)}
                            aria-label={`复制 ${inviteCode.code}`}
                          >
                            {isCopied ? "已复制" : "复制"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>用户</h2>
              <p>仅显示用户名、状态和最近登录时间，不暴露密码摘要。</p>
            </div>
            <span className="admin-pill">{users.length} 人</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>用户名</th>
                  <th>显示名</th>
                  <th>状态</th>
                  <th>创建时间</th>
                  <th>最后登录</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.displayName}</td>
                    <td>
                      <span className={`admin-status-chip is-${user.status}`}>{user.status}</span>
                    </td>
                    <td>{user.createdAt}</td>
                    <td>{user.lastLoginAt ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
