import type { NextRequest } from "next/server";

export function getRequestClientKey(request: NextRequest, userId: string | null) {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || "unknown";

  return userId ? `user:${userId}` : `ip:${ip}`;
}
