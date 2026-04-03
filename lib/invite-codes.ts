import { randomBytes } from "node:crypto";

import {
  createInviteCode,
  findInviteCodeByCode,
  listInviteCodes as listInviteCodeRecords,
  markInviteCodeUsed,
  type InviteCodeRecord
} from "@/lib/auth-db";

const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomChunk(length: number) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (value) => INVITE_ALPHABET[value % INVITE_ALPHABET.length]).join("");
}

function generateInviteCode() {
  return `ATLAS-${randomChunk(4)}-${randomChunk(4)}`;
}

export function createInviteCodes(createdBy: string, count = 20, presetCodes?: string[]) {
  const codes: InviteCodeRecord[] = [];
  const seen = new Set<string>();

  while (codes.length < count) {
    const code = presetCodes?.[codes.length] ?? generateInviteCode();
    if (seen.has(code) || findInviteCodeByCode(code)) {
      if (presetCodes) {
        throw new Error(`duplicate preset invite code: ${code}`);
      }
      continue;
    }
    seen.add(code);
    codes.push(createInviteCode({ code, createdBy }));
  }

  return codes;
}

export function listInviteCodes() {
  return listInviteCodeRecords();
}

export function consumeInviteCode(code: string, userId: string) {
  const inviteCode = findInviteCodeByCode(code);
  if (!inviteCode || inviteCode.status !== "active") {
    return null;
  }

  return markInviteCodeUsed(code, userId);
}
