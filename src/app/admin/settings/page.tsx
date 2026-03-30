import { AdminSettingsClient } from "@/components/admin/admin-settings-client";
import { listPlanDefinitions } from "@/lib/billing/plans";
import { listLegalDocumentsWithVersions } from "@/lib/legal-documents";
import { listPlatformCopyEntries, listPlatformSettings } from "@/lib/platform-config";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export default async function AdminSettingsPage() {
  const admin = getSupabaseAdminClient();
  const [settings, copyEntries, plans, legal] = await Promise.all([
    listPlatformSettings(admin),
    listPlatformCopyEntries(admin),
    listPlanDefinitions(admin),
    listLegalDocumentsWithVersions(admin)
  ]);

  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <section className="card stack">
        <h2>Ajustes de plataforma</h2>
        <p className="muted">
          Todo lo editable aquí sale de DB. Cambios de políticas, copy visible, pricing y documentos legales se reflejan sin redeploy.
        </p>
      </section>

      <AdminSettingsClient
        initialSettings={settings}
        initialCopyEntries={copyEntries}
        initialPlans={plans}
        initialLegalDocuments={legal.documents}
        initialLegalVersions={legal.versions}
      />
    </div>
  );
}
