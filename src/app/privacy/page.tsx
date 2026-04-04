import { MarkdownLite } from "@/components/content/markdown-lite";
import { getPublishedLegalDocument } from "@/lib/legal-documents";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";
import { PlatformNav } from "@/components/platform-nav";
import { PlatformFooter } from "@/components/platform-footer";

export default async function PrivacyPage() {
  const admin = getSupabaseAdminClient();
  const supabase = await getSupabaseServerClient();
  const [{ version }, { data: { user } }] = await Promise.all([
    getPublishedLegalDocument(admin, "privacy"),
    supabase.auth.getUser()
  ]);

  return (
    <>
    <PlatformNav isAuthenticated={!!user} />
    <main className="dashboard-shell">
      <div className="dashboard-container stack">
        <section className="card stack">
          <small className="dashboard-chip">Legal</small>
          <div className="stack stack-sm">
            <h1>{version.title}</h1>
            <p className="muted">
              Versión {version.version_label}
              {version.published_at ? ` · Publicado el ${new Date(version.published_at).toLocaleDateString("es-CO")}` : ""}
            </p>
          </div>
          <MarkdownLite markdown={version.body_markdown} className="stack" stripFirstHeading />
        </section>
      </div>
    </main>
    <PlatformFooter />
    </>
  );
}
