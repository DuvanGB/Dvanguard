import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth";
import { getBillingSummary, listBillingInvoices } from "@/lib/billing/subscription";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const { user } = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  const [summary, invoices] = await Promise.all([getBillingSummary(admin, user.id), listBillingInvoices(admin, user.id)]);

  return NextResponse.json({ summary, invoices });
}
