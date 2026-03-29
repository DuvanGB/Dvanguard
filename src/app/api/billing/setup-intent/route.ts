import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json(
    { error: "SetupIntent dejó de existir en el flujo Wompi-first." },
    { status: 410 }
  );
}
