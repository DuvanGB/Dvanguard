import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireBuyerApiUser } from "@/lib/buyer-auth";

const querySchema = z.object({
  siteId: z.string().uuid()
});

export async function GET(request: NextRequest) {
  const { user, supabase } = await requireBuyerApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    siteId: request.nextUrl.searchParams.get("siteId")
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", issues: parsed.error.issues }, { status: 400 });
  }

  const { data: cart } = await supabase
    .from("buyer_carts")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("site_id", parsed.data.siteId)
    .eq("status", "active")
    .maybeSingle();

  if (!cart) {
    return NextResponse.json({ items: [] });
  }

  const { data: items, error } = await supabase
    .from("buyer_cart_items")
    .select("id, block_id, name, price, currency, quantity, image_url")
    .eq("cart_id", cart.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ items: (items ?? []).map(mapCartItem) });
}

function mapCartItem(item: {
  id: string;
  block_id: string;
  name: string;
  price: number | null;
  currency: string | null;
  quantity: number;
  image_url: string | null;
}) {
  return {
    id: item.id,
    blockId: item.block_id,
    name: item.name,
    price: item.price ?? undefined,
    currency: item.currency ?? undefined,
    quantity: item.quantity,
    imageUrl: item.image_url ?? undefined
  };
}
