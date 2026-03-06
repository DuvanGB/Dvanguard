import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { getOwnedSiteWithCurrentSpec, saveSiteSpecVersion } from "@/lib/canvas/store";

const rectSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  z: z.number().int()
});

const bodySchema = z.object({
  sectionId: z.string().min(1),
  blockId: z.string().min(1),
  viewport: z.enum(["desktop", "mobile"]),
  rect: rectSchema
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase } = await requireApiUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const result = await getOwnedSiteWithCurrentSpec({ supabase, siteId: id, userId: user.id });
  if (!result) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const { sectionId, blockId, rect, viewport } = parsed.data;
  const nextSpec = structuredClone(result.spec);
  let updated = false;

  for (const page of nextSpec.pages) {
    for (const section of page.sections) {
      if (section.id !== sectionId) continue;
      section.blocks = section.blocks.map((block) => {
        if (block.id !== blockId) return block;
        updated = true;
        return {
          ...block,
          layout: {
            ...block.layout,
            [viewport]: rect
          }
        };
      });
    }
  }

  if (!updated) return NextResponse.json({ error: "Block not found" }, { status: 404 });

  try {
    const saved = await saveSiteSpecVersion({
      supabase,
      siteId: id,
      spec: nextSpec,
      source: "canvas_manual_checkpoint"
    });

    return NextResponse.json({ ok: true, versionId: saved.versionId, deduped: saved.deduped });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la versión del canvas" },
      { status: 400 }
    );
  }
}
