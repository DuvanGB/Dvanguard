import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json(
    { error: "Stripe fue retirado del producto. Usa las rutas de /api/billing/wompi/*." },
    { status: 410 }
  );
}
