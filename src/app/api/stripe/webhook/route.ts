import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Stripe fue retirado del producto. Configura tus eventos en /api/billing/wompi/webhook." },
    { status: 410 }
  );
}
