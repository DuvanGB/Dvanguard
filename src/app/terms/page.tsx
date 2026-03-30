import { MarkdownLite } from "@/components/content/markdown-lite";
import { getPublishedLegalDocument } from "@/lib/legal-documents";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export default async function TermsPage() {
  const admin = getSupabaseAdminClient();
  const { version } = await getPublishedLegalDocument(admin, "terms");

  return (
    <main className="dashboard-shell">
      <div className="dashboard-container stack">
        <section className="card stack">
          <small className="dashboard-chip">Legal</small>
          <div className="stack" style={{ gap: "0.35rem" }}>
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
  );
}
