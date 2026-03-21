import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 4318);
const WORKER_SECRET = process.env.AI_WORKER_SHARED_SECRET || "";
const MODEL = process.env.AI_WORKER_MODEL || "qwen2.5:7b-instruct";
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, { ok: true, model: MODEL });
    }

    if (req.method === "POST" && url.pathname === "/refine") {
      if (!isAuthorized(req)) return sendJson(res, 401, { error: "Unauthorized" });
      const body = await readJson(req);
      return sendJson(res, 200, { briefDraft: buildHeuristicBrief(body.rawInput || "") });
    }

    if (req.method === "POST" && url.pathname === "/design/generate-home") {
      if (!isAuthorized(req)) return sendJson(res, 401, { error: "Unauthorized" });
      const body = await readJson(req);
      if (!body?.jobId || !body?.callbackBaseUrl) {
        return sendJson(res, 400, { error: "Missing jobId or callbackBaseUrl" });
      }

      queueMicrotask(() => {
        runVisualGeneration(body).catch((error) => {
          console.error("[worker] visual generation failed", error);
        });
      });

      return sendJson(res, 202, { status: "accepted", jobId: body.jobId });
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown worker error" });
  }
}).listen(PORT, () => {
  console.log(`[ai-worker] listening on :${PORT}`);
});

async function runVisualGeneration(input) {
  const callbackUrl = `${String(input.callbackBaseUrl).replace(/\/$/, "")}/api/internal/ai-jobs/${input.jobId}/progress`;
  const proposal = await requestProposalFromModel(input).catch(() => buildHeuristicLayoutProposal(input));
  const fallbackUsed = Boolean(proposal.__fallback);
  const source = fallbackUsed ? "fallback" : "worker";

  await postProgress(callbackUrl, {
    stage: "brief_analysis",
    progressPercent: 12,
    message: "Analizando tu negocio",
    source,
    fallbackUsed,
    completed: false
  });
  await wait(450);

  await postProgress(callbackUrl, {
    stage: "visual_direction",
    progressPercent: 34,
    message: "Definiendo dirección visual",
    layoutProposal: sliceProposal(proposal, ["hero"]),
    source,
    fallbackUsed,
    completed: false
  });
  await wait(650);

  await postProgress(callbackUrl, {
    stage: "layout_seed",
    progressPercent: 62,
    message: "Armando layout inicial",
    layoutProposal: sliceProposal(proposal, ["hero", "catalog"]),
    source,
    fallbackUsed,
    completed: false
  });
  await wait(650);

  await postProgress(callbackUrl, {
    stage: "content_polish",
    progressPercent: 84,
    message: "Aplicando contenido y estilo",
    layoutProposal: proposal,
    source,
    fallbackUsed,
    completed: false
  });
  await wait(500);

  await postProgress(callbackUrl, {
    stage: "finalizing",
    progressPercent: 100,
    message: "Preparando preview editable",
    layoutProposal: proposal,
    source,
    fallbackUsed,
    completed: true
  });
}

async function requestProposalFromModel(input) {
  if (!promptAvailable(input.prompt)) {
    return buildHeuristicLayoutProposal(input);
  }

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      format: "json",
      messages: [
        {
          role: "system",
          content:
            "Devuelve SOLO JSON válido para una homepage usando este contrato: " +
            "{design_direction:{name,description},header_variant,section_order,section_compositions,theme_direction}. " +
            "No generes HTML. section_compositions solo puede usar hero, catalog, testimonials, contact. " +
            "La estructura debe dejar siempre testimonials como penúltima sección y contact como última sección cuando ambas existan. " +
            "Tu trabajo es proponer composición interna de bloques dentro de cada sección. " +
            "Usa familias distintas por sección, por ejemplo hero: editorial, split-brand, compact-sale, centered-clean, image-left; " +
            "catalog: three-grid, mosaic, featured-left, featured-top, service-cards, service-strip; " +
            "testimonials: wall, spotlight, compact-band, quote-column; contact: CTA band, split contact, card CTA. " +
            "Cada bloque debe usar matchId existentes como hero-bg, hero-overlay, headline, subheadline, hero-image, " +
            "title, product-1, product-2, product-3, card-1, image-1, name-1, desc-1, quote-1, description, contact-cta."
        },
        {
          role: "user",
          content: [
            `Prompt: ${String(input.prompt || "")}`,
            `Brief: ${JSON.stringify(input.briefDraft || {})}`,
            "Quiero una sola propuesta visual fuerte, distinta por composición y jerarquía, no solo por color."
          ].join("\n")
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama HTTP ${response.status}`);
  }

  const payload = await response.json();
  const raw = payload?.message?.content || payload?.response || "";
  const parsed = safeParseJson(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid model JSON");
  }

  return parsed;
}

async function postProgress(callbackUrl, payload) {
  const response = await fetch(callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-worker-secret": WORKER_SECRET
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Callback failed ${response.status}: ${text}`);
  }
}

function buildHeuristicLayoutProposal(input) {
  const prompt = String(input.prompt || "").toLowerCase();
  const brief = input.briefDraft || {};
  const seed = hashString([brief.business_name || "", brief.offer_summary || "", brief.tone || "", prompt].join("|"));
  const siteType = String(brief.business_type || "").includes("commerce") || /tienda|producto|catalog|venta/.test(prompt)
    ? "commerce_lite"
    : "informative";
  const premium = /premium|lujo|exclusiv|editorial|atelier|streetwear/.test(prompt);
  const fashion = /moda|ropa|zapato|sneaker|boutique|fashion/.test(prompt);
  const sport = /deport|fitness|gym|gimnas|running/.test(prompt);
  const tech = /tech|software|digital|app|saas|gadgets|tecnolog/.test(prompt);
  const health = /salud|clinica|wellness|spa|medic/.test(prompt);
  const stylePreset = brief.style_preset || (tech || sport ? "ocean" : health || fashion || premium ? "sunset" : "ocean");
  const theme = themeFor(stylePreset, { premium, health, fashion });

  const sectionOrder =
    siteType === "commerce_lite"
      ? premium
        ? ["hero", "catalog", "contact", "testimonials"]
        : ["hero", "catalog", "testimonials", "contact"]
      : tech
        ? ["hero", "catalog", "testimonials", "contact"]
        : ["hero", "catalog", "testimonials", "contact"];
  const normalizedSectionOrder = enforceDefaultSectionOrder(sectionOrder);
  const heroBuilders =
    siteType === "commerce_lite"
      ? fashion || premium
        ? [heroEditorial, heroService, heroTech]
        : tech
          ? [heroTech, heroService, heroSoft]
          : sport
            ? [heroService, heroTech, heroSoft]
            : [heroService, heroSoft, heroTech]
      : tech
        ? [heroTech, heroSoft, heroService]
        : [heroService, heroSoft, heroTech];
  const catalogBuilders =
    siteType === "commerce_lite"
      ? fashion || premium
        ? [catalogFeatured, catalogMosaic, catalogGrid]
        : tech
          ? [catalogMosaic, catalogFeatured, catalogGrid]
          : [catalogGrid, catalogFeatured, catalogMosaic]
      : tech
        ? [infoStrip, infoCards]
        : [infoCards, infoStrip];
  const testimonialBuilders =
    premium || fashion
      ? [testimonialsBand, testimonialsWall, testimonialsSpotlight]
      : health
        ? [testimonialsSpotlight, testimonialsWall, testimonialsBand]
        : [testimonialsWall, testimonialsSpotlight, testimonialsBand];
  const contactBuilders =
    premium || fashion
      ? [contactBand, contactSplit, contactMinimal]
      : tech
        ? [contactSplit, contactMinimal, contactBand]
        : [contactMinimal, contactSplit, contactBand];

  const hero = pickBuilder(heroBuilders, seed + 1)(brief, theme);
  const catalog = pickBuilder(catalogBuilders, seed + 7)(theme);
  const testimonials = pickBuilder(testimonialBuilders, seed + 13)(theme);
  const contact = pickBuilder(contactBuilders, seed + 19)(theme);

  return {
    __fallback: true,
    design_direction: {
      name: premium ? "Editorial premium" : fashion ? "Marca visual" : sport ? "Energía comercial" : tech ? "Lanzamiento moderno" : health ? "Confianza serena" : "Conversión clara",
      description: premium
        ? "Hero dominante con narrativa de marca y contraste alto."
        : fashion
          ? "Composición de marca con foco visual en producto y estilo."
          : sport
            ? "Jerarquía activa con lectura rápida y bloques de venta."
        : tech
          ? "Composición moderna con ritmo de producto o servicio."
          : health
            ? "Presentación amable y confiable con jerarquía suave."
            : "Layout directo orientado a lectura rápida y CTA."
    },
    header_variant: premium || fashion ? "top-bar" : siteType === "commerce_lite" ? "hamburger-overlay" : "none",
    section_order: normalizedSectionOrder,
    section_compositions: [hero, catalog, testimonials, contact]
      .filter((section) => normalizedSectionOrder.includes(section.type))
      .sort((a, b) => normalizedSectionOrder.indexOf(a.type) - normalizedSectionOrder.indexOf(b.type)),
    theme_direction: theme
  };
}

function sliceProposal(proposal, allowedTypes) {
  return {
    ...proposal,
    section_order: proposal.section_order.filter((type) => allowedTypes.includes(type)),
    section_compositions: proposal.section_compositions.filter((section) => allowedTypes.includes(section.type))
  };
}

function heroEditorial(brief, theme) {
  return {
    type: "hero",
    variant: "split",
    height_ratio: { desktop: 0.82, mobile: 1.32 },
    blocks: [
      compose("hero-bg", true, rect(0, 0, 100, 100, 1), rect(0, 0, 100, 100, 1), undefined, { fit: "cover" }),
      compose("hero-overlay", true, rect(0, 0, 100, 100, 2), rect(0, 0, 100, 100, 2), { bgColor: "#09090b", opacity: 0.52 }),
      compose("headline", true, rect(6, 14, 54, 22, 3), rect(8, 14, 84, 18, 3), { fontSize: 64, fontWeight: 700, color: "#f8fafc" }, { text: brief.business_name }),
      compose("subheadline", true, rect(6, 40, 38, 12, 3), rect(8, 36, 84, 12, 3), { fontSize: 19, color: "#d4d4d8" }, { text: heroSubtitle(brief) }),
      compose("hero-image", true, rect(58, 10, 34, 72, 2), rect(8, 58, 84, 28, 2), { radius: 0 }, { fit: "cover" })
    ]
  };
}

function heroTech(brief, theme) {
  return {
    type: "hero",
    variant: "split",
    height_ratio: { desktop: 0.68, mobile: 1.18 },
    blocks: [
      compose("headline", true, rect(8, 16, 46, 16, 3), rect(8, 14, 84, 16, 3), { fontSize: 54, fontWeight: 700, color: theme.primary }, { text: brief.business_name }),
      compose("subheadline", true, rect(8, 36, 42, 12, 3), rect(8, 32, 84, 12, 3), { fontSize: 18, color: "#334155" }, { text: heroSubtitle(brief) }),
      compose("hero-image", true, rect(58, 16, 30, 52, 2), rect(12, 58, 76, 22, 2), { radius: 22 }, { fit: "cover" })
    ]
  };
}

function heroSoft(brief, theme) {
  return {
    type: "hero",
    variant: "centered",
    height_ratio: { desktop: 0.64, mobile: 1.2 },
    blocks: [
      compose("headline", true, rect(18, 12, 64, 16, 3), rect(8, 12, 84, 16, 3), { fontSize: 52, fontWeight: 700, textAlign: "center", color: theme.primary }, { text: brief.business_name }),
      compose("subheadline", true, rect(20, 32, 60, 12, 3), rect(8, 30, 84, 12, 3), { fontSize: 18, textAlign: "center", color: "#475569" }, { text: heroSubtitle(brief) }),
      compose("hero-image", true, rect(22, 54, 56, 28, 2), rect(10, 54, 80, 24, 2), { radius: 22 }, { fit: "cover" })
    ]
  };
}

function heroService(brief, theme) {
  return {
    type: "hero",
    variant: "image-left",
    height_ratio: { desktop: 0.6, mobile: 1.16 },
    blocks: [
      compose("hero-image", true, rect(8, 16, 32, 52, 1), rect(14, 56, 72, 24, 1), { radius: 18 }, { fit: "cover" }),
      compose("headline", true, rect(48, 16, 42, 14, 3), rect(8, 14, 84, 16, 3), { fontSize: 48, fontWeight: 700, color: theme.primary }, { text: brief.business_name }),
      compose("subheadline", true, rect(48, 34, 38, 12, 3), rect(8, 32, 84, 12, 3), { fontSize: 18, color: "#475569" }, { text: heroSubtitle(brief) })
    ]
  };
}

function catalogGrid(theme) {
  return section("catalog", "grid", { desktop: 0.68, mobile: 1.75 }, [
    compose("title", true, rect(8, 8, 52, 10, 2), rect(8, 4, 84, 8, 2), { fontSize: 38, fontWeight: 700, color: theme.primary }),
    compose("product-1", true, rect(8, 22, 26, 62, 1), rect(8, 18, 84, 22, 1)),
    compose("product-2", true, rect(38, 22, 26, 62, 1), rect(8, 44, 84, 22, 1)),
    compose("product-3", true, rect(68, 22, 26, 62, 1), rect(8, 70, 84, 22, 1))
  ]);
}

function catalogMosaic(theme) {
  return section("catalog", "grid", { desktop: 0.72, mobile: 1.86 }, [
    compose("title", true, rect(8, 8, 52, 10, 2), rect(8, 4, 84, 8, 2), { fontSize: 38, fontWeight: 700, color: theme.primary }),
    compose("product-1", true, rect(8, 22, 38, 62, 1), rect(8, 18, 84, 22, 1)),
    compose("product-2", true, rect(50, 22, 42, 28, 1), rect(8, 44, 84, 22, 1)),
    compose("product-3", true, rect(50, 54, 42, 30, 1), rect(8, 70, 84, 22, 1))
  ]);
}

function catalogFeatured(theme) {
  return section("catalog", "list", { desktop: 0.76, mobile: 1.82 }, [
    compose("title", true, rect(8, 8, 52, 10, 2), rect(8, 4, 84, 8, 2), { fontSize: 40, fontWeight: 700, color: theme.primary }),
    compose("product-1", true, rect(8, 22, 56, 62, 1), rect(8, 18, 84, 22, 1)),
    compose("product-2", true, rect(68, 22, 24, 28, 1), rect(8, 44, 84, 22, 1)),
    compose("product-3", true, rect(68, 54, 24, 30, 1), rect(8, 70, 84, 22, 1))
  ]);
}

function infoCards(theme) {
  return section("catalog", "cards", { desktop: 0.6, mobile: 1.38 }, [
    compose("title", true, rect(8, 8, 52, 10, 2), rect(8, 4, 84, 8, 2), { fontSize: 36, fontWeight: 700, color: theme.primary }),
    compose("card-1", true, rect(8, 22, 26, 56, 1), rect(8, 18, 84, 24, 1)),
    compose("image-1", true, rect(10, 24, 22, 20, 2), rect(12, 20, 76, 10, 2), { radius: 14 }, { fit: "cover" }),
    compose("name-1", true, rect(10, 48, 18, 6, 3), rect(12, 32, 70, 5, 3), { fontSize: 20, fontWeight: 700 }),
    compose("desc-1", true, rect(10, 56, 20, 12, 3), rect(12, 40, 70, 8, 3), { fontSize: 14, color: "#475569" }),
    compose("card-2", true, rect(38, 22, 26, 56, 1), rect(8, 46, 84, 24, 1)),
    compose("image-2", true, rect(40, 24, 22, 20, 2), rect(12, 48, 76, 10, 2), { radius: 14 }, { fit: "cover" }),
    compose("name-2", true, rect(40, 48, 18, 6, 3), rect(12, 60, 70, 5, 3), { fontSize: 20, fontWeight: 700 }),
    compose("desc-2", true, rect(40, 56, 20, 12, 3), rect(12, 68, 70, 8, 3), { fontSize: 14, color: "#475569" }),
    compose("card-3", true, rect(68, 22, 26, 56, 1), rect(8, 74, 84, 24, 1)),
    compose("image-3", true, rect(70, 24, 22, 20, 2), rect(12, 76, 76, 10, 2), { radius: 14 }, { fit: "cover" }),
    compose("name-3", true, rect(70, 48, 18, 6, 3), rect(12, 88, 70, 5, 3), { fontSize: 20, fontWeight: 700 }),
    compose("desc-3", true, rect(70, 56, 20, 12, 3), rect(12, 94, 70, 4, 3), { fontSize: 14, color: "#475569" })
  ]);
}

function infoStrip(theme) {
  return section("catalog", "list", { desktop: 0.5, mobile: 1.26 }, [
    compose("title", true, rect(8, 8, 52, 10, 2), rect(8, 4, 84, 8, 2), { fontSize: 36, fontWeight: 700, color: theme.primary }),
    compose("card-1", true, rect(8, 24, 84, 14, 1), rect(8, 18, 84, 18, 1)),
    compose("name-1", true, rect(12, 28, 30, 4, 2), rect(12, 22, 70, 5, 2), { fontSize: 18, fontWeight: 700 }),
    compose("desc-1", true, rect(12, 33, 54, 4, 2), rect(12, 28, 70, 5, 2), { fontSize: 14, color: "#475569" }),
    compose("card-2", true, rect(8, 44, 84, 14, 1), rect(8, 42, 84, 18, 1)),
    compose("name-2", true, rect(12, 48, 30, 4, 2), rect(12, 46, 70, 5, 2), { fontSize: 18, fontWeight: 700 }),
    compose("desc-2", true, rect(12, 53, 54, 4, 2), rect(12, 52, 70, 5, 2), { fontSize: 14, color: "#475569" }),
    compose("card-3", true, rect(8, 64, 84, 14, 1), rect(8, 66, 84, 18, 1)),
    compose("name-3", true, rect(12, 68, 30, 4, 2), rect(12, 70, 70, 5, 2), { fontSize: 18, fontWeight: 700 }),
    compose("desc-3", true, rect(12, 73, 54, 4, 2), rect(12, 76, 70, 5, 2), { fontSize: 14, color: "#475569" })
  ]);
}

function testimonialsWall(theme) {
  return section("testimonials", "cards", { desktop: 0.3, mobile: 0.88 }, [
    compose("title", true, rect(8, 10, 58, 10, 2), rect(8, 6, 84, 10, 2), { fontSize: 32, fontWeight: 700 }),
    compose("quote-1", true, rect(8, 30, 26, 18, 2), rect(8, 20, 84, 16, 2), quoteCard()),
    compose("quote-2", true, rect(38, 30, 26, 18, 2), rect(8, 40, 84, 16, 2), quoteCard()),
    compose("quote-3", true, rect(68, 30, 26, 18, 2), rect(8, 60, 84, 16, 2), quoteCard())
  ]);
}

function testimonialsSpotlight(theme) {
  return section("testimonials", "spotlight", { desktop: 0.34, mobile: 0.98 }, [
    compose("title", true, rect(8, 10, 58, 10, 2), rect(8, 6, 84, 10, 2), { fontSize: 32, fontWeight: 700 }),
    compose("quote-1", true, rect(8, 28, 44, 28, 2), rect(8, 20, 84, 20, 2), quoteCard(17)),
    compose("quote-2", true, rect(56, 28, 36, 12, 2), rect(8, 46, 84, 14, 2), quoteCard(15)),
    compose("quote-3", true, rect(56, 44, 36, 12, 2), rect(8, 64, 84, 14, 2), quoteCard(15))
  ]);
}

function testimonialsBand(theme) {
  return section("testimonials", "minimal", { desktop: 0.24, mobile: 0.72 }, [
    compose("title", true, rect(8, 12, 38, 10, 2), rect(8, 8, 84, 10, 2), { fontSize: 30, fontWeight: 700, color: theme.primary }),
    compose("quote-1", true, rect(8, 38, 84, 10, 2), rect(8, 34, 84, 14, 2), { fontSize: 19, color: "#52525b" })
  ]);
}

function contactMinimal(theme) {
  return section("contact", "simple", { desktop: 0.24, mobile: 0.72 }, [
    compose("title", true, rect(8, 18, 34, 10, 2), rect(8, 12, 84, 10, 2), { fontSize: 32, fontWeight: 700 }),
    compose("description", true, rect(8, 34, 42, 10, 2), rect(8, 28, 84, 10, 2), { fontSize: 17, color: "#475569" }),
    compose("contact-cta", true, rect(8, 52, 18, 12, 3), rect(8, 48, 42, 12, 3), undefined, { label: "WhatsApp" })
  ]);
}

function contactSplit(theme) {
  return section("contact", "highlight", { desktop: 0.28, mobile: 0.82 }, [
    compose("title", true, rect(8, 18, 28, 10, 2), rect(8, 12, 84, 10, 2), { fontSize: 34, fontWeight: 700 }),
    compose("description", true, rect(42, 18, 30, 12, 2), rect(8, 28, 84, 10, 2), { fontSize: 17, color: "#475569" }),
    compose("contact-cta", true, rect(8, 52, 22, 12, 3), rect(8, 50, 50, 12, 3), undefined, { label: "Hablar ahora" })
  ]);
}

function contactBand(theme) {
  return section("contact", "compact", { desktop: 0.2, mobile: 0.62 }, [
    compose("title", true, rect(8, 24, 22, 10, 2), rect(8, 14, 84, 10, 2), { fontSize: 30, fontWeight: 700, color: theme.primary }),
    compose("description", true, rect(34, 24, 34, 10, 2), rect(8, 30, 84, 10, 2), { fontSize: 17, color: "#a1a1aa" }),
    compose("contact-cta", true, rect(72, 22, 18, 14, 3), rect(8, 46, 52, 12, 3), undefined, { label: "Escribir" })
  ]);
}

function section(type, variant, height_ratio, blocks) {
  return { type, variant, height_ratio, blocks };
}

function compose(matchId, visible, desktop, mobile, style, content) {
  return { matchId, visible, layout: { desktop, mobile }, style, content };
}

function rect(x, y, w, h, z) {
  return { x, y, w, h, z };
}

function themeFor(stylePreset, flags) {
  if (stylePreset === "mono") {
    return {
      primary: "#f8fafc",
      secondary: "#f97316",
      background: "#09090b",
      font_heading: "Space Grotesk",
      font_body: "Manrope",
      radius: "sm"
    };
  }
  if (stylePreset === "sunset" || flags.health || flags.fashion) {
    return {
      primary: "#0f172a",
      secondary: "#ea580c",
      background: "#fff7ed",
      font_heading: "Montserrat",
      font_body: "Open Sans",
      radius: "md"
    };
  }
  return {
    primary: "#082f49",
    secondary: "#0ea5e9",
    background: "#f4fbff",
    font_heading: "Space Grotesk",
    font_body: "Manrope",
    radius: "md"
  };
}

function heroSubtitle(brief) {
  const offer = String(brief.offer_summary || "Propuesta clara y visual.");
  const audience = String(brief.target_audience || "clientes potenciales").toLowerCase();
  return `${offer} Para ${audience}.`.slice(0, 220);
}

function quoteCard(fontSize = 16) {
  return {
    fontSize,
    bgColor: "#ffffff",
    radius: 14,
    borderColor: "#dbe3ee",
    borderWidth: 1,
    color: "#334155"
  };
}

function enforceDefaultSectionOrder(order) {
  const unique = order.filter((value, index, list) => list.indexOf(value) === index);
  const trailing = ["testimonials", "contact"];
  const leading = unique.filter((section) => !trailing.includes(section));
  return [...leading, ...trailing.filter((section) => unique.includes(section))];
}

function pickBuilder(builders, seed) {
  return builders[Math.abs(seed) % builders.length];
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildHeuristicBrief(rawInput) {
  const trimmed = String(rawInput || "").trim();
  return {
    business_name: trimmed.slice(0, 80) || "Tu negocio",
    business_type: /tienda|producto|catalog|venta/i.test(trimmed) ? "commerce_lite" : "informative",
    offer_summary: trimmed || "Presentación principal del negocio.",
    target_audience: "Clientes potenciales en redes y WhatsApp",
    tone: "Claro y directo",
    primary_cta: "WhatsApp",
    section_preferences: /tienda|producto|catalog|venta/i.test(trimmed)
      ? ["hero", "catalog", "testimonials", "contact"]
      : ["hero", "testimonials", "contact"],
    style_preset: /premium|elegante/i.test(trimmed) ? "sunset" : /moderno|tech|digital/i.test(trimmed) ? "ocean" : "mono"
  };
}

function promptAvailable(prompt) {
  return typeof prompt === "string" && prompt.trim().length >= 8;
}

function isAuthorized(req) {
  return WORKER_SECRET && req.headers["x-worker-secret"] === WORKER_SECRET;
}

function safeParseJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = String(raw).replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    return JSON.parse(cleaned);
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
