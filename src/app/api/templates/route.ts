import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { TEMPLATE_CATALOG, getTemplatesBySiteType } from "@/lib/templates/catalog";

const querySchema = z.object({
  siteType: z.enum(["informative", "commerce_lite"]).optional()
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    siteType: request.nextUrl.searchParams.get("siteType") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", issues: parsed.error.issues }, { status: 400 });
  }

  const templates = parsed.data.siteType
    ? getTemplatesBySiteType(parsed.data.siteType)
    : TEMPLATE_CATALOG;

  return NextResponse.json({
    items: templates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      tags: template.tags,
      family: template.family,
      site_type: template.site_type,
      preview_label: template.preview_label,
      theme: template.theme,
      variants: template.variants
    }))
  });
}
