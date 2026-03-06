import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { getOwnedSiteWithCurrentSpec, saveSiteSpecVersion } from "@/lib/canvas/store";

const blockPatchSchema = z.object({
  sectionId: z.string().min(1),
  patch: z.record(z.string(), z.unknown())
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; blockId: string }> }
) {
  const { id, blockId } = await params;
  const { user, supabase } = await requireApiUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = blockPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const result = await getOwnedSiteWithCurrentSpec({ supabase, siteId: id, userId: user.id });
  if (!result) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const nextSpec = structuredClone(result.spec);
  let updated = false;

  for (const page of nextSpec.pages) {
    for (const section of page.sections) {
      if (section.id !== parsed.data.sectionId) continue;
      section.blocks = section.blocks.map((block) => {
        if (block.id !== blockId) return block;
        updated = true;
        return {
          ...block,
          ...parsed.data.patch
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; blockId: string }> }
) {
  const { id, blockId } = await params;
  const { user, supabase } = await requireApiUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const sectionId = typeof body.sectionId === "string" ? body.sectionId : "";
  if (!sectionId) {
    return NextResponse.json({ error: "sectionId is required" }, { status: 400 });
  }

  const result = await getOwnedSiteWithCurrentSpec({ supabase, siteId: id, userId: user.id });
  if (!result) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const nextSpec = structuredClone(result.spec);
  let removed = false;

  for (const page of nextSpec.pages) {
    for (const section of page.sections) {
      if (section.id !== sectionId) continue;
      const before = section.blocks.length;
      section.blocks = section.blocks.filter((block) => block.id !== blockId);
      removed = section.blocks.length < before;
    }
  }

  if (!removed) return NextResponse.json({ error: "Block not found" }, { status: 404 });

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
