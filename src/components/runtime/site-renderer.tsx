"use client";

import { useEffect, useMemo, useRef } from "react";

import type { AnySiteSpec } from "@/lib/site-spec-any";
import { buildFallbackSiteSpecV3, parseSiteSpecV3 } from "@/lib/site-spec-v3";
import { CanvasSection } from "@/components/runtime/sections";

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
  const parsed = parseSiteSpecV3(spec);
  const normalized = parsed.success
    ? parsed.data
    : buildFallbackSiteSpecV3("Negocio local", {
        siteType: "informative"
      });

  const homepage = normalized.pages.find((page) => page.slug === "/") ?? normalized.pages[0] ?? null;
  const whatsapp = normalized.integrations.whatsapp;
  const whatsappLink = whatsapp?.enabled && whatsapp.phone ? `https://wa.me/${whatsapp.phone}` : undefined;

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

  const rendererWidth = viewport === "mobile" ? 390 : "100%";

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
        width: rendererWidth,
        maxWidth: "100%",
        margin: 0,
        border: "none",
        borderRadius: 0,
        overflow: "hidden"
      }}
    >
      {(homepage?.sections ?? [])
        .filter((section) => section.enabled)
        .map((section) => (
          <CanvasSection
            key={section.id}
            section={section}
            viewport={viewport}
            theme={normalized.theme}
            whatsappLink={whatsappLink}
            onTrackCtaClick={trackCta}
            onTrackWhatsappClick={trackWhatsapp}
          />
        ))}
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
