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
  const prompt = String(input.prompt || "");
  const callbackUrl = `${String(input.callbackBaseUrl).replace(/\/$/, "")}/api/internal/ai-jobs/${input.jobId}/progress`;
  const patch = await requestPatchFromModel(input).catch(() => buildHeuristicDesignPatch(input));
  const layoutOnlyPatch = {
    ...patch,
    blockPatches: (patch.blockPatches || []).filter((item) =>
      ["headline", "subheadline", "hero-image", "hero-bg", "hero-overlay"].some((value) => item.matchId.includes(value))
    )
  };
  const directionPatch = {
    visualDirection: patch.visualDirection,
    templateFamily: patch.templateFamily,
    themePatch: patch.themePatch,
    sectionHeightPatch: patch.sectionHeightPatch
  };

  await postProgress(callbackUrl, {
    stage: "brief_analysis",
    progressPercent: 12,
    message: "Analizando tu negocio",
    source: "worker",
    fallbackUsed: false,
    completed: false
  });
  await wait(500);

  await postProgress(callbackUrl, {
    stage: "visual_direction",
    progressPercent: 34,
    message: "Definiendo dirección visual",
    designPatch: directionPatch,
    source: patch.__fallback ? "fallback" : "worker",
    fallbackUsed: Boolean(patch.__fallback),
    completed: false
  });
  await wait(700);

  await postProgress(callbackUrl, {
    stage: "layout_seed",
    progressPercent: 62,
    message: "Armando layout inicial",
    designPatch: layoutOnlyPatch,
    source: patch.__fallback ? "fallback" : "worker",
    fallbackUsed: Boolean(patch.__fallback),
    completed: false
  });
  await wait(700);

  await postProgress(callbackUrl, {
    stage: "content_polish",
    progressPercent: 84,
    message: "Aplicando contenido y estilo",
    designPatch: patch,
    source: patch.__fallback ? "fallback" : "worker",
    fallbackUsed: Boolean(patch.__fallback),
    completed: false
  });
  await wait(600);

  await postProgress(callbackUrl, {
    stage: "finalizing",
    progressPercent: 100,
    message: "Preparando preview editable",
    designPatch: patch,
    source: patch.__fallback ? "fallback" : "worker",
    fallbackUsed: Boolean(patch.__fallback),
    completed: true
  });
}

async function requestPatchFromModel(input) {
  if (!promptAvailable(input.prompt)) {
    const patch = buildHeuristicDesignPatch(input);
    patch.__fallback = true;
    return patch;
  }

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      format: "json",
      messages: [
        {
          role: "system",
          content:
            "Devuelve SOLO JSON válido con una propuesta visual para una home de sitio web. " +
            "No generes HTML. Debes responder con las claves: visualDirection, templateFamily, themePatch, sectionHeightPatch, blockPatches. " +
            "Los blockPatches deben referirse a ids parciales como headline, subheadline, hero-image, hero-bg, hero-overlay, title."
        },
        {
          role: "user",
          content: [
            `Prompt: ${String(input.prompt || "")}`,
            `Template elegida: ${String(input.templateId || "none")}`,
            `Brief: ${JSON.stringify(input.briefDraft || {})}`,
            "Quiero una sola propuesta visual fuerte para homepage. Responde solo JSON."
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

function buildHeuristicDesignPatch(input) {
  const prompt = String(input.prompt || "").toLowerCase();
  const brief = input.briefDraft || {};
  const dark = /premium|street|zapato|sneaker|moda|tech/i.test(prompt);
  const commerce = String(brief.business_type || "").includes("commerce") || /tienda|producto|catalog/i.test(prompt);
  const stylePreset = brief.style_preset || (dark ? "mono" : "ocean");

  const themePatch =
    stylePreset === "mono"
      ? {
          primary: "#f8fafc",
          secondary: "#fb923c",
          background: "#09090b",
          font_heading: "Space Grotesk",
          font_body: "Manrope",
          radius: "sm"
        }
      : stylePreset === "sunset"
        ? {
            primary: "#0f172a",
            secondary: "#f97316",
            background: "#fff7ed",
            font_heading: "Montserrat",
            font_body: "Open Sans",
            radius: "md"
          }
        : {
            primary: "#082f49",
            secondary: "#0ea5e9",
            background: "#f4fbff",
            font_heading: "Space Grotesk",
            font_body: "Manrope",
            radius: "md"
          };

  return {
    __fallback: true,
    visualDirection: {
      name: dark ? "Editorial de alto contraste" : commerce ? "Comercial dinámica" : "Presentación limpia",
      description: dark ? "Hero grande con narrativa premium." : "Jerarquía directa y escaneable.",
      headerVariant: dark ? "top-bar" : commerce ? "hamburger-overlay" : "none"
    },
    templateFamily: dark ? "editorial_dark" : commerce ? "tech_launch" : "minimal_service",
    themePatch,
    sectionHeightPatch: {
      hero: { desktop: dark ? 0.78 : 0.64, mobile: dark ? 1.26 : 1.14 },
      catalog: { desktop: commerce ? 0.68 : 0.5, mobile: commerce ? 1.75 : 1.2 },
      testimonials: { desktop: 0.28, mobile: 0.82 },
      contact: { desktop: 0.22, mobile: 0.68 }
    },
    blockPatches: [
      {
        sectionType: "hero",
        matchId: "headline",
        layout: {
          desktop: dark ? { x: 6, y: 12, w: 54, h: 22, z: 3 } : { x: 8, y: 14, w: 48, h: 16, z: 3 },
          mobile: dark ? { x: 8, y: 14, w: 82, h: 18, z: 3 } : { x: 8, y: 14, w: 84, h: 16, z: 3 }
        },
        style: {
          fontSize: dark ? 60 : 46,
          fontWeight: 700,
          color: dark ? "#f8fafc" : themePatch.primary,
          textAlign: "left"
        },
        content: {
          text: String(brief.business_name || "Tu negocio")
        }
      },
      {
        sectionType: "hero",
        matchId: "subheadline",
        layout: {
          desktop: dark ? { x: 6, y: 40, w: 42, h: 14, z: 3 } : { x: 8, y: 34, w: 50, h: 12, z: 3 },
          mobile: dark ? { x: 8, y: 34, w: 84, h: 14, z: 3 } : { x: 8, y: 32, w: 84, h: 12, z: 3 }
        },
        style: {
          fontSize: dark ? 19 : 17,
          color: dark ? "#d4d4d8" : "#475569",
          textAlign: "left"
        },
        content: {
          text: `${String(brief.offer_summary || "Propuesta clara y visual.")} Para ${String(brief.target_audience || "clientes potenciales").toLowerCase()}.`
        }
      },
      {
        sectionType: "hero",
        matchId: "hero-image",
        visible: true,
        layout: {
          desktop: dark ? { x: 56, y: 8, w: 38, h: 78, z: 1 } : { x: 56, y: 18, w: 34, h: 58, z: 1 },
          mobile: dark ? { x: 8, y: 58, w: 84, h: 30, z: 1 } : { x: 10, y: 58, w: 80, h: 24, z: 1 }
        },
        style: { radius: dark ? 0 : 18 },
        content: { fit: "cover" }
      },
      {
        sectionType: "hero",
        matchId: "hero-bg",
        visible: dark,
        content: { fit: "cover" }
      },
      {
        sectionType: "hero",
        matchId: "hero-overlay",
        visible: dark,
        style: { bgColor: "#09090b", opacity: 0.46 }
      },
      {
        sectionType: "catalog",
        matchId: "title",
        style: { fontSize: commerce ? 38 : 32, fontWeight: 700, color: themePatch.primary }
      }
    ]
  };
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

