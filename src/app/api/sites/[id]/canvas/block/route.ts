import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { getOwnedSiteWithCurrentSpec, saveSiteSpecVersion } from "@/lib/canvas/store";
import { canvasBlockSchema } from "@/lib/site-spec-v3";

const bodySchema = z.object({
  sectionId: z.string().min(1),
  block: canvasBlockSchema
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

  const { sectionId, block } = parsed.data;
  const hasSection = result.spec.pages.some((page) => page.sections.some((section) => section.id === sectionId));
  if (!hasSection) return NextResponse.json({ error: "Section not found" }, { status: 404 });

  const nextSpec = structuredClone(result.spec);
  for (const page of nextSpec.pages) {
    for (const section of page.sections) {
      if (section.id === sectionId) {
        section.blocks.push(block);
      }
    }
  }

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
