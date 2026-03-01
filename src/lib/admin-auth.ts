import { redirect } from "next/navigation";

import { requireApiUser, requireUser } from "@/lib/auth";
import { env } from "@/lib/env";

function parseAllowlist(raw: string) {
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;

  const allowlist = parseAllowlist(env.adminAllowlistEmails);
  return allowlist.has(email.toLowerCase());
}

export async function requireAdminUser() {
  const context = await requireUser();

  if (!isAdminEmail(context.user.email)) {
    redirect("/dashboard");
  }

  return context;
}

export async function requireAdminApiUser() {
  const context = await requireApiUser();

  if (!context.user) {
    return { ...context, error: "Unauthorized", status: 401 as const };
  }

  if (!isAdminEmail(context.user.email)) {
    return { ...context, error: "Forbidden", status: 403 as const };
  }

  return { ...context, error: null, status: 200 as const };
}
