"use client";

import { useEffect, useMemo, useRef } from "react";

import type { AnySiteSpec } from "@/lib/site-spec-any";
import { parseAnySiteSpec } from "@/lib/site-spec-any";
import { buildSiteSpecV2FromTemplate } from "@/lib/site-spec-v2";
import type { SiteSectionV2 } from "@/lib/site-spec-v2";
import { CatalogSection, ContactSection, HeroSection, TestimonialsSection } from "@/components/runtime/sections";

export type EditorViewport = "desktop" | "mobile";

type Props = {
  spec: AnySiteSpec | unknown;
  viewport?: EditorViewport;
  trackEvents?: boolean;
  siteId?: string;
  subdomain?: string;
};

export function SiteRenderer({ spec, viewport = "desktop", trackEvents = false, siteId, subdomain }: Props) {
  const trackedVisitRef = useRef(false);
  const parsed = parseAnySiteSpec(spec);
  const normalized = parsed.success
    ? parsed.data
    : buildSiteSpecV2FromTemplate({
        siteType: "informative",
        businessName: "Tu negocio"
      });

  const homepage = normalized.pages.find((page) => page.slug === "/") ?? normalized.pages[0] ?? null;
  const whatsapp = normalized.integrations.whatsapp;
  const contactSection = (homepage?.sections ?? []).find(
    (section): section is Extract<SiteSectionV2, { type: "contact" }> => section.type === "contact"
  );
  const phone = contactSection?.props.whatsapp_phone;
  const whatsappPhone = whatsapp?.phone ?? phone;
  const whatsappLink = whatsapp?.enabled && whatsappPhone ? `https://wa.me/${whatsappPhone}` : undefined;

  const pageSlug = useMemo(() => {
    if (typeof window === "undefined") return "/";
    return window.location.pathname || "/";
  }, []);

  useEffect(() => {
    if (!trackEvents || !siteId || !subdomain || trackedVisitRef.current) return;
    trackedVisitRef.current = true;
    void sendTrackEvent({
      eventType: "visit",
      siteId,
      subdomain,
      pageSlug,
      sectionId: null
    });
  }, [pageSlug, siteId, subdomain, trackEvents]);

  const rendererWidth = viewport === "mobile" ? 430 : undefined;

  function trackCta(sectionId: string) {
    if (!trackEvents || !siteId || !subdomain) return;
    void sendTrackEvent({
      eventType: "cta_click",
      siteId,
      subdomain,
      pageSlug,
      sectionId
    });
  }

  function trackWhatsapp(sectionId: string) {
    if (!trackEvents || !siteId || !subdomain) return;
    void sendTrackEvent({
      eventType: "whatsapp_click",
      siteId,
      subdomain,
      pageSlug,
      sectionId
    });
  }

  return (
    <main
      style={{
        background: normalized.theme.background,
        color: normalized.theme.primary,
        minHeight: "100vh",
        fontFamily: normalized.theme.font_body,
        maxWidth: rendererWidth,
        margin: rendererWidth ? "0 auto" : undefined,
        border: rendererWidth ? "1px solid var(--border)" : undefined,
        borderRadius: rendererWidth ? "0.75rem" : undefined,
        overflow: rendererWidth ? "hidden" : undefined
      }}
    >
      {(homepage?.sections ?? [])
        .filter((section) => section.enabled)
        .map((section) => {
          if (section.type === "hero") {
            return (
              <HeroSection
                key={section.id}
                section={section}
                whatsappLink={whatsappLink}
                theme={normalized.theme}
                onTrackCtaClick={trackCta}
              />
            );
          }

          if (section.type === "catalog") {
            return <CatalogSection key={section.id} section={section} whatsappLink={whatsappLink} theme={normalized.theme} />;
          }

          if (section.type === "testimonials") {
            return (
              <TestimonialsSection key={section.id} section={section} whatsappLink={whatsappLink} theme={normalized.theme} />
            );
          }

          return (
            <ContactSection
              key={section.id}
              section={section}
              whatsappLink={whatsappLink}
              theme={normalized.theme}
              onTrackWhatsappClick={trackWhatsapp}
            />
          );
        })}
    </main>
  );
}

type PublicTrackEventPayload = {
  eventType: "visit" | "whatsapp_click" | "cta_click";
  siteId: string;
  subdomain: string;
  pageSlug: string;
  sectionId: string | null;
};

async function sendTrackEvent(payload: PublicTrackEventPayload) {
  const clientId = getOrCreateClientId();
  const requestBody = JSON.stringify({
    eventType: payload.eventType,
    siteId: payload.siteId,
    subdomain: payload.subdomain,
    pageSlug: payload.pageSlug,
    sectionId: payload.sectionId ?? undefined,
    clientId
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([requestBody], { type: "application/json" });
      navigator.sendBeacon("/api/public/track", blob);
      return;
    }
  } catch {
    // fallback to fetch
  }

  try {
    await fetch("/api/public/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
      keepalive: true
    });
  } catch {
    // best effort tracking
  }
}

function getOrCreateClientId() {
  if (typeof window === "undefined") return undefined;

  const key = "dvanguard_client_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const next = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : undefined;
  if (next) {
    window.localStorage.setItem(key, next);
  }

  return next;
}
