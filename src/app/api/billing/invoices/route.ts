import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth";
import { listBillingInvoices } from "@/lib/billing/subscription";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const { user } = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  const invoices = await listBillingInvoices(admin, user.id);
  return NextResponse.json({ invoices });
}
