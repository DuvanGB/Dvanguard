import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

import { syncBillingTransactionFromWompi } from "@/lib/billing/subscription";
import { env } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

function readTransactionId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.transaction_id === "string") return record.transaction_id;
  if (record.data && typeof record.data === "object") {
    const data = record.data as Record<string, unknown>;
    if (data.transaction && typeof data.transaction === "object" && typeof (data.transaction as Record<string, unknown>).id === "string") {
      return String((data.transaction as Record<string, unknown>).id);
    }
    if (typeof data.transaction_id === "string") return data.transaction_id;
    if (typeof data.id === "string") return data.id;
  }
  return null;
}

function getNestedValue(target: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, target);
}

function validateWompiEventSignature(payload: unknown, headerChecksum: string | null) {
  if (!env.wompiEventsSecret) return true;
  if (!payload || typeof payload !== "object") return false;

  const record = payload as Record<string, unknown>;
  const signature = record.signature;
  const timestamp = record.timestamp;
  if (!signature || typeof signature !== "object" || typeof timestamp !== "number") return false;

  const checksum = headerChecksum ?? (typeof (signature as Record<string, unknown>).checksum === "string" ? String((signature as Record<string, unknown>).checksum) : null);
  const properties = Array.isArray((signature as Record<string, unknown>).properties) ? ((signature as Record<string, unknown>).properties as string[]) : [];
  if (!checksum || !properties.length) return false;

  const concatenated = properties
    .map((property) => {
      const cleaned = property.replace(/^data\./, "");
      const source = record.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : {};
      const value = getNestedValue(source, cleaned);
      return value == null ? "" : String(value);
    })
    .join("");

  const expected = createHash("sha256").update(`${concatenated}${timestamp}${env.wompiEventsSecret}`).digest("hex");
  return expected === checksum;
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const headerChecksum = request.headers.get("x-event-checksum");
  if (!validateWompiEventSignature(payload, headerChecksum)) {
    return NextResponse.json({ error: "Invalid Wompi event signature" }, { status: 401 });
  }

  const transactionId = readTransactionId(payload);
  if (!transactionId) {
    return NextResponse.json({ error: "Missing transaction id" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  try {
    const result = await syncBillingTransactionFromWompi(admin, transactionId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo sincronizar el evento de Wompi" },
      { status: 400 }
    );
  }
}
