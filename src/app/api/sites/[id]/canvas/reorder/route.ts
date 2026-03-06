import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { getOwnedSiteWithCurrentSpec, saveSiteSpecVersion } from "@/lib/canvas/store";

const bodySchema = z.object({
  sectionId: z.string().min(1),
  blockIds: z.array(z.string().min(1)).min(1)
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

  const { sectionId, blockIds } = parsed.data;
  const nextSpec = structuredClone(result.spec);
  let reordered = false;

  for (const page of nextSpec.pages) {
    for (const section of page.sections) {
      if (section.id !== sectionId) continue;

      const byId = new Map(section.blocks.map((block) => [block.id, block]));
      const nextBlocks = blockIds.map((idItem) => byId.get(idItem)).filter((item): item is NonNullable<typeof item> => Boolean(item));

      if (nextBlocks.length !== section.blocks.length) {
        return NextResponse.json({ error: "blockIds must include all blocks in the section" }, { status: 400 });
      }

      section.blocks = nextBlocks.map((block, index) => ({
        ...block,
        layout: {
          ...block.layout,
          desktop: {
            ...block.layout.desktop,
            z: index + 1
          },
          mobile: block.layout.mobile
            ? {
                ...block.layout.mobile,
                z: index + 1
              }
            : block.layout.mobile
        }
      }));
      reordered = true;
    }
  }

  if (!reordered) return NextResponse.json({ error: "Section not found" }, { status: 404 });

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
