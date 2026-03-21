import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { businessBriefDraftSchema } from "@/lib/onboarding/types";
import { buildTemplateAlternativeSpec } from "@/lib/ai/visual-generation";
import { getTemplateById } from "@/lib/templates/catalog";
import { templateIds } from "@/lib/templates/types";

const bodySchema = z.object({
  briefDraft: businessBriefDraftSchema,
  templateId: z.enum(templateIds)
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase } = await requireApiUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const { data: site } = await supabase.from("sites").select("id").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const template = getTemplateById(parsed.data.templateId);
  if (!template || template.site_type !== parsed.data.briefDraft.business_type) {
    return NextResponse.json({ error: "Template no válida para este tipo de sitio." }, { status: 400 });
  }

  const siteSpec = buildTemplateAlternativeSpec({
    briefDraft: parsed.data.briefDraft,
    templateId: parsed.data.templateId
  });

  return NextResponse.json({ siteSpec });
}
