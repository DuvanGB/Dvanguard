import { NextResponse } from "next/server";
import { z } from "zod";

import { requireBuyerApiUser } from "@/lib/buyer-auth";

const cartItemSchema = z.object({
  blockId: z.string().min(1),
  name: z.string().min(1).max(140),
  price: z.number().min(0).optional(),
  currency: z.string().min(1).max(8).optional(),
  imageUrl: z.string().url().optional(),
  quantity: z.number().int().min(1).max(99).default(1)
});

const bodySchema = z.object({
  siteId: z.string().uuid(),
  items: z.array(cartItemSchema).max(50)
});

export async function POST(request: Request) {
  const { user, supabase } = await requireBuyerApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const cart = await getOrCreateCart(supabase, user.id, parsed.data.siteId);
  if (!cart) {
    return NextResponse.json({ error: "No se pudo crear el carrito" }, { status: 400 });
  }

  for (const item of parsed.data.items) {
    const { data: existing } = await supabase
      .from("buyer_cart_items")
      .select("id, quantity")
      .eq("cart_id", cart.id)
      .eq("block_id", item.blockId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("buyer_cart_items")
        .update({ quantity: existing.quantity + item.quantity })
        .eq("id", existing.id);
    } else {
      await supabase.from("buyer_cart_items").insert({
        cart_id: cart.id,
        block_id: item.blockId,
        name: item.name,
        price: item.price ?? null,
        currency: item.currency ?? null,
        quantity: item.quantity,
        image_url: item.imageUrl ?? null
      });
    }
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

async function getOrCreateCart(supabase: any, buyerId: string, siteId: string) {
  const { data: existing } = await supabase
    .from("buyer_carts")
    .select("id")
    .eq("buyer_id", buyerId)
    .eq("site_id", siteId)
    .eq("status", "active")
    .maybeSingle();

  if (existing) return existing;

  const { data: created } = await supabase
    .from("buyer_carts")
    .insert({ buyer_id: buyerId, site_id: siteId, status: "active" })
    .select("id")
    .maybeSingle();

  return created ?? null;
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
