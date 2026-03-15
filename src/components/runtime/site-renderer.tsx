"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import type { AnySiteSpec } from "@/lib/site-spec-any";
import { buildFallbackSiteSpecV3, parseSiteSpecV3 } from "@/lib/site-spec-v3";
import { CanvasSection, type ProductCartItem } from "@/components/runtime/sections";

export type EditorViewport = "desktop" | "mobile";

type Props = {
  spec: AnySiteSpec | unknown;
  viewport?: EditorViewport;
  trackEvents?: boolean;
  siteId?: string;
  subdomain?: string;
  enableCart?: boolean;
};

export function SiteRenderer({ spec, viewport, trackEvents = false, siteId, subdomain, enableCart = false }: Props) {
  const trackedVisitRef = useRef(false);
  const [responsiveViewport, setResponsiveViewport] = useState<EditorViewport>(viewport ?? "desktop");
  const parsed = parseSiteSpecV3(spec);
  const normalized = parsed.success
    ? parsed.data
    : buildFallbackSiteSpecV3("Negocio local", {
        siteType: "informative"
      });

  const homepage = normalized.pages.find((page) => page.slug === "/") ?? normalized.pages[0] ?? null;
  const headerVariant = normalized.header?.variant ?? "none";
  const headerBrand = normalized.header?.brand ?? homepage?.title ?? "Inicio";
  const headerLinks = buildSectionLinks(homepage?.sections ?? []);
  const whatsapp = normalized.integrations.whatsapp;
  const whatsappMessage = whatsapp?.message?.trim();
  const whatsappLink =
    whatsapp?.enabled && whatsapp.phone
      ? `https://wa.me/${whatsapp.phone}${whatsappMessage ? `?text=${encodeURIComponent(whatsappMessage)}` : ""}`
      : undefined;
  const whatsappPhone = whatsapp?.enabled ? whatsapp.phone : undefined;
  const hasProducts = normalized.pages.some((page) =>
    page.sections.some((section) => section.blocks.some((block) => block.type === "product"))
  );
  const cartEnabled =
    enableCart &&
    Boolean(siteId) &&
    normalized.site_type === "commerce_lite" &&
    hasProducts;
  const cart = usePublicCart({
    enabled: cartEnabled,
    siteId: siteId ?? "",
    whatsappPhone,
    whatsappMessage
  });
  const cartVisible = cartEnabled || cart.items.length > 0;

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

  useEffect(() => {
    if (viewport) return;
    const updateViewport = () => {
      setResponsiveViewport(window.innerWidth < 768 ? "mobile" : "desktop");
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, [viewport]);

  const activeViewport = viewport ?? responsiveViewport;
  const rendererWidth = activeViewport === "mobile" ? "100%" : "100%";

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
      {headerVariant !== "none" ? (
        <SiteHeader
          variant={headerVariant}
          brand={headerBrand}
          links={headerLinks}
          theme={normalized.theme}
        />
      ) : null}
      {(homepage?.sections ?? [])
        .filter((section) => section.enabled)
        .map((section) => (
          <CanvasSection
            key={section.id}
            section={section}
            viewport={activeViewport}
            theme={normalized.theme}
            whatsappLink={whatsappLink}
            onAddToCart={cartEnabled ? cart.addItem : undefined}
            onTrackCtaClick={trackCta}
            onTrackWhatsappClick={trackWhatsapp}
          />
        ))}
      {cartVisible ? (
        <CartDock
          items={cart.items}
          open={cart.open}
          onToggle={() => cart.setOpen((prev) => !prev)}
          onClose={() => cart.setOpen(false)}
          onRemove={cart.removeItem}
          onUpdateQuantity={cart.updateQuantity}
          onCheckout={cart.checkout}
          buyer={cart.buyer}
          buyerEmail={cart.buyerEmail}
          onBuyerEmailChange={cart.setBuyerEmail}
          onBuyerStart={cart.startBuyerLogin}
          statusMessage={cart.statusMessage}
        />
      ) : null}
    </main>
  );
}

type HeaderLink = {
  label: string;
  href: string;
};

function buildSectionLinks(sections: Array<{ id: string; type: string }>): HeaderLink[] {
  const labels: Record<string, string> = {
    hero: "Inicio",
    catalog: "Catálogo",
    testimonials: "Testimonios",
    contact: "Contacto"
  };

  return sections.filter((section) => "enabled" in section ? section.enabled : true).map((section) => ({
    label: labels[section.type] ?? section.type,
    href: `#${section.id}`
  }));
}

function SiteHeader({
  variant,
  brand,
  links,
  theme
}: {
  variant: "none" | "hamburger-side" | "hamburger-overlay" | "top-bar";
  brand: string;
  links: HeaderLink[];
  theme: { primary: string; secondary: string; background: string; font_heading: string; font_body: string };
}) {
  const [open, setOpen] = useState(false);

  const headerStyle: CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.75rem 1.5rem",
    background: theme.background,
    borderBottom: `1px solid ${theme.secondary}22`
  };

  const brandStyle: CSSProperties = {
    fontFamily: theme.font_heading,
    fontWeight: 700,
    fontSize: "1.1rem",
    color: theme.primary
  };

  if (variant === "top-bar") {
    return (
      <header style={headerStyle}>
        <span style={brandStyle}>{brand}</span>
        <nav style={{ display: "flex", gap: "1rem", fontSize: "0.95rem" }}>
          {links.map((link) => (
            <a key={link.href} href={link.href} style={{ color: theme.primary, textDecoration: "none", fontWeight: 600 }}>
              {link.label}
            </a>
          ))}
        </nav>
      </header>
    );
  }

  const toggleButton = (
    <button
      type="button"
      onClick={() => setOpen((prev) => !prev)}
      style={{
        border: `1px solid ${theme.secondary}33`,
        background: "transparent",
        borderRadius: 999,
        padding: "0.4rem 0.65rem",
        color: theme.primary,
        display: "grid",
        placeItems: "center",
        cursor: "pointer"
      }}
      aria-label="Abrir menú"
    >
      ☰
    </button>
  );

  return (
    <>
      <header style={headerStyle}>
        {toggleButton}
        <span style={brandStyle}>{brand}</span>
        <div style={{ width: 40 }} />
      </header>
      {open ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: variant === "hamburger-overlay" ? "rgba(15, 23, 42, 0.65)" : "transparent",
            zIndex: 80
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: variant === "hamburger-side" ? 0 : "10%",
              right: variant === "hamburger-side" ? "auto" : "10%",
              width: variant === "hamburger-side" ? "72%" : "80%",
              maxWidth: 360,
              height: "100%",
              background: theme.background,
              padding: "1.5rem",
              boxShadow: "0 18px 48px rgba(15, 23, 42, 0.25)"
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <strong style={brandStyle}>{brand}</strong>
              <button type="button" onClick={() => setOpen(false)} style={{ border: "none", background: "transparent", fontSize: "1.2rem", cursor: "pointer" }}>
                ✕
              </button>
            </div>
            <nav style={{ display: "grid", gap: "0.75rem" }}>
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  style={{
                    color: theme.primary,
                    textDecoration: "none",
                    fontWeight: 600,
                    padding: "0.5rem 0.25rem"
                  }}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
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

type CartItem = {
  id?: string;
  blockId: string;
  name: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  quantity: number;
};

type BuyerSession = {
  id: string;
  email: string | null;
};

function usePublicCart(input: {
  enabled: boolean;
  siteId: string;
  whatsappPhone?: string;
  whatsappMessage?: string;
}) {
  const { enabled, siteId, whatsappPhone, whatsappMessage } = input;
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [buyer, setBuyer] = useState<BuyerSession | null>(null);
  const [buyerEmail, setBuyerEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"local" | "buyer">("local");

  const localKey = useMemo(() => `dvanguard-cart:${siteId}`, [siteId]);

  useEffect(() => {
    if (!enabled || !siteId) return;
    const localItems = loadLocalCart(localKey);
    if (localItems.length) {
      setItems(localItems);
    }
    let cancelled = false;

    async function bootstrap() {
      try {
        const sessionRes = await fetch("/api/public/buyer/session");
        const sessionData = (await sessionRes.json()) as { user?: BuyerSession | null };
        if (cancelled) return;
        if (sessionRes.ok && sessionData.user) {
          setBuyer(sessionData.user);
          setMode("buyer");
          const cartRes = await fetch(`/api/public/cart?siteId=${siteId}`);
          const cartData = (await cartRes.json()) as { items?: CartItem[] };
          if (cancelled) return;
          if (cartRes.ok) {
            if (localItems.length) {
              const merged = await mergeCart(siteId, localItems);
              if (!cancelled) {
                setItems(merged);
                clearLocalCart(localKey);
              }
            } else {
              setItems(cartData.items ?? []);
            }
          }
        }
      } catch {
        // best effort
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [enabled, localKey, siteId]);

  useEffect(() => {
    if (!enabled || mode !== "local") return;
    saveLocalCart(localKey, items);
  }, [enabled, items, localKey, mode]);

  async function addItem(item: ProductCartItem) {
    if (!enabled) return;
    const nextItem: CartItem = {
      blockId: item.blockId,
      name: item.name,
      price: item.price,
      currency: item.currency,
      imageUrl: item.imageUrl,
      quantity: 1
    };

    if (mode === "buyer") {
      const response = await fetch("/api/public/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, item: nextItem })
      });
      const data = (await response.json()) as { items?: CartItem[]; error?: string };
      if (!response.ok) {
        setStatusMessage(data.error ?? "No se pudo agregar al carrito.");
        return;
      }
      setItems(data.items ?? []);
      setOpen(true);
      return;
    }

    setItems((prev) => mergeLocalItem(prev, nextItem));
    setOpen(true);
  }

  async function updateQuantity(item: CartItem, quantity: number) {
    const safeQty = Math.max(1, Math.min(quantity, 99));
    if (mode === "buyer" && item.id) {
      const response = await fetch(`/api/public/cart/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: safeQty })
      });
      const data = (await response.json()) as { items?: CartItem[]; error?: string };
      if (!response.ok) {
        setStatusMessage(data.error ?? "No se pudo actualizar el carrito.");
        return;
      }
      setItems(data.items ?? []);
      return;
    }

    setItems((prev) =>
      prev.map((existing) => (existing.blockId === item.blockId ? { ...existing, quantity: safeQty } : existing))
    );
  }

  async function removeItem(item: CartItem) {
    if (mode === "buyer" && item.id) {
      const response = await fetch(`/api/public/cart/items/${item.id}`, { method: "DELETE" });
      const data = (await response.json()) as { items?: CartItem[]; error?: string };
      if (!response.ok) {
        setStatusMessage(data.error ?? "No se pudo eliminar el item.");
        return;
      }
      setItems(data.items ?? []);
      return;
    }
    setItems((prev) => prev.filter((existing) => existing.blockId !== item.blockId));
  }

  function checkout() {
    if (!whatsappPhone) {
      setStatusMessage("WhatsApp no configurado en este sitio.");
      return;
    }
    if (!items.length) {
      setStatusMessage("Tu carrito está vacío.");
      return;
    }

    const currency = items.find((item) => item.currency)?.currency ?? "COP";
    const total = items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
    const lines = items.map(
      (item) => `• ${item.name} x${item.quantity} - ${formatCurrency(item.price ?? 0, item.currency ?? currency)}`
    );
    const header = whatsappMessage?.trim() || "Hola, quiero comprar:";
    const message = [header, ...lines, `Total: ${formatCurrency(total, currency)}`].join("\n");
    const link = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
    window.open(link, "_blank");
  }

  async function startBuyerLogin() {
    const email = buyerEmail.trim();
    if (!email) {
      setStatusMessage("Ingresa un correo válido.");
      return;
    }
    const nextPath = `${window.location.pathname}${window.location.search}`;
    const response = await fetch("/api/public/buyer/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, next: nextPath })
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatusMessage(data.error ?? "No se pudo enviar el enlace.");
      return;
    }
    setStatusMessage("Revisa tu correo para continuar.");
  }

  return {
    items,
    open,
    setOpen,
    buyer,
    buyerEmail,
    setBuyerEmail,
    statusMessage,
    addItem,
    updateQuantity,
    removeItem,
    checkout,
    startBuyerLogin
  };
}

async function mergeCart(siteId: string, items: CartItem[]) {
  const response = await fetch("/api/public/cart/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ siteId, items })
  });
  const data = (await response.json()) as { items?: CartItem[] };
  if (!response.ok) return items;
  return data.items ?? items;
}

function mergeLocalItem(existing: CartItem[], nextItem: CartItem) {
  const match = existing.find((item) => item.blockId === nextItem.blockId);
  if (!match) return [...existing, nextItem];
  return existing.map((item) =>
    item.blockId === nextItem.blockId ? { ...item, quantity: item.quantity + nextItem.quantity } : item
  );
}

function loadLocalCart(key: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalCart(key: string, items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function clearLocalCart(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency,
      maximumFractionDigits: 0
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function CartDock(props: {
  items: CartItem[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onUpdateQuantity: (item: CartItem, quantity: number) => void;
  onRemove: (item: CartItem) => void;
  onCheckout: () => void;
  buyer: BuyerSession | null;
  buyerEmail: string;
  onBuyerEmailChange: (value: string) => void;
  onBuyerStart: () => void;
  statusMessage: string | null;
}) {
  const total = props.items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
  const currency = props.items.find((item) => item.currency)?.currency ?? "COP";

  return (
    <div className="cart-dock">
      <button type="button" className="cart-fab" onClick={props.onToggle}>
        Carrito ({props.items.reduce((sum, item) => sum + item.quantity, 0)})
      </button>

      {props.open ? (
        <aside className="cart-panel">
          <div className="cart-panel-header">
            <strong>Tu carrito</strong>
            <button type="button" className="btn-secondary" onClick={props.onClose}>
              Cerrar
            </button>
          </div>

          {!props.items.length ? <p className="muted">Aún no agregas productos.</p> : null}
          {props.items.map((item) => (
            <div key={item.blockId} className="cart-item">
              <div className="cart-item-info">
                <strong>{item.name}</strong>
                <small>{formatCurrency(item.price ?? 0, item.currency ?? currency)}</small>
              </div>
              <div className="cart-item-actions">
                <button type="button" onClick={() => props.onUpdateQuantity(item, Math.max(1, item.quantity - 1))}>
                  -
                </button>
                <span>{item.quantity}</span>
                <button type="button" onClick={() => props.onUpdateQuantity(item, item.quantity + 1)}>
                  +
                </button>
                <button type="button" className="danger" onClick={() => props.onRemove(item)}>
                  ✕
                </button>
              </div>
            </div>
          ))}

          {props.items.length ? (
            <div className="cart-summary">
              <span>Total</span>
              <strong>{formatCurrency(total, currency)}</strong>
            </div>
          ) : null}

          <button type="button" className="btn-primary" onClick={props.onCheckout} disabled={!props.items.length}>
            Pagar por WhatsApp
          </button>

          <div className="cart-login">
            {props.buyer ? (
              <small>Comprador: {props.buyer.email ?? "sesión activa"}</small>
            ) : (
              <>
                <small>Guarda tu carrito iniciando sesión.</small>
                <div className="cart-login-form">
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    value={props.buyerEmail}
                    onChange={(event) => props.onBuyerEmailChange(event.target.value)}
                  />
                  <button type="button" className="btn-secondary" onClick={props.onBuyerStart}>
                    Enviar enlace
                  </button>
                </div>
              </>
            )}
          </div>
          {props.statusMessage ? <small className="muted">{props.statusMessage}</small> : null}
        </aside>
      ) : null}
    </div>
  );
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
