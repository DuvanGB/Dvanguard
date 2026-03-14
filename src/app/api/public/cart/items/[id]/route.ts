import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireBuyerApiUser } from "@/lib/buyer-auth";

const patchSchema = z.object({
  quantity: z.number().int().min(1).max(99)
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user, supabase } = await requireBuyerApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const { data: item } = await supabase
    .from("buyer_cart_items")
    .select("id, cart_id")
    .eq("id", id)
    .maybeSingle();

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("buyer_cart_items")
    .update({ quantity: parsed.data.quantity })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const { data: items, error } = await supabase
    .from("buyer_cart_items")
    .select("id, block_id, name, price, currency, quantity, image_url")
    .eq("cart_id", item.cart_id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ items: (items ?? []).map(mapCartItem) });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user, supabase } = await requireBuyerApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { data: item } = await supabase
    .from("buyer_cart_items")
    .select("id, cart_id")
    .eq("id", id)
    .maybeSingle();

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabase.from("buyer_cart_items").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  const { data: items, error } = await supabase
    .from("buyer_cart_items")
    .select("id, block_id, name, price, currency, quantity, image_url")
    .eq("cart_id", item.cart_id)
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
