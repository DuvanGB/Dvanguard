import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json(
    { error: "La actualización de tarjeta ahora se hace vía /api/billing/wompi/card/subscribe o /switch-to-card." },
    { status: 410 }
  );
}
