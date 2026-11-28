import fs from 'node:fs';
import path from 'node:path';
import {
  HTML_MODELS_LIBRARY,
  type MirvoLessonStep,
  type MirvoPartMeta,
  type SavedHtmlModelEntry,
} from '../data/htmlModelsLibrary.js';
import type { TokenUsageInfo } from '../types/tutor.js';
import { sanitizeQwenApiKey } from './qwenHtmlGenerator.js';
import { usageFromDashScope, type DashScopeUsageLike } from './tokenUsage.js';

const DASHSCOPE_ENDPOINTS = [
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  'https://dashscope-us.aliyuncs.com/compatible-mode/v1',
  'https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1',
  'https://dashscope.aliyuncs.com/compatible-mode/v1',
];

const ADAPTER_MODELS = [
  'qwen4-max',
  'qwen3.5-plus',
  'qwen3.8-omni-flash',
  'qwen-plus',
] as const;

export interface AddonPartSpec {
  id: string;
  nameUz: string;
  svgX: number;
  svgY: number;
  zoom: number;
  defsSvg?: string;
  groupSvg: string;
}

export interface SceneAdaptResult {
  mode: 'focus_only' | 'svg_addon';
  baseModelId: string;
  lessonTitleUz: string;
  publicPath?: string;
  patchedHtml?: string;
  parts: MirvoPartMeta[];
  steps: MirvoLessonStep[];
  modelUsed: string;
  tokenUsage: TokenUsageInfo;
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const trimmed = (raw || '').trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // try stripping markdown fences
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim()) as Record<string, unknown>;
    } catch {
      // fall through
    }
  }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
  }
  throw new Error('Qwen JSON javobini o‘qib bo‘lmadi.');
}

async function loadTemplateHtml(
  model: SavedHtmlModelEntry,
  originUrl?: string
): Promise<string> {
  const candidates = [
    path.join(process.cwd(), 'public', 'models', `${model.slug}.html`),
    path.join(process.cwd(), 'dist', 'models', `${model.slug}.html`),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, 'utf8');
      }
    } catch {
      // try next path
    }
  }

  if (originUrl) {
    const cleanOrigin = originUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanOrigin}${model.publicPath}`);
    if (res.ok) {
      return await res.text();
    }
  }

  throw new Error(`Shablon HTML fayli topilmadi: ${model.publicPath}`);
}

/**
 * Non-destructively injects 1..2 modular SVG addon groups + gradients + 60 FPS flow & camera bridge
 * into an existing 1,800-3,200 line MirvoScene HTML file WITHOUT altering a single existing part!
 */
export function patchModularHtmlWithAddon(
  originalHtml: string,
  addonParts: AddonPartSpec[]
): string {
  if (!addonParts.length) return originalHtml;

  let html = originalHtml;

  // 1. Inject custom <defs> gradients/filters right before the first </defs>
  const combinedDefs = addonParts
    .map((p) => (p.defsSvg || '').trim())
    .filter(Boolean)
    .join('\n');

  if (combinedDefs && /<\/defs>/i.test(html)) {
    html = html.replace(/<\/defs>/i, `\n<!-- Mirvo AI Addon Defs -->\n${combinedDefs}\n</defs>`);
  }

  // 2. Inject modular <g id="mirvo-ai-addon-layer"> right before the main scene </svg>
  // Note: MirvoScene templates have a single full-canvas <svg viewBox="0 0 1600 900">...</svg>
  const combinedGroups = addonParts
    .map((p) => {
      const g = (p.groupSvg || '').trim();
      // Guarantee outer group carries class="mirvo-part" and data-part="<id>"
      if (g.startsWith('<g') && g.includes(`data-part="${p.id}"`)) {
        return g;
      }
      return `<g class="mirvo-part" data-part="${p.id}">\n${g}\n</g>`;
    })
    .join('\n');

  const svgCloseIdx = html.indexOf('</svg>');
  if (svgCloseIdx > 0) {
    html =
      html.slice(0, svgCloseIdx) +
      `\n        <!-- MIRVO AI NON-DESTRUCTIVE ADDON LAYER -->\n        <g id="mirvo-ai-addon-layer">\n${combinedGroups}\n        </g>\n      ` +
      html.slice(svgCloseIdx);
  }

  // 3. Inject lightweight universal bridge script right before </body> so:
  //    - Animated .mirvo-addon-flow strokes flow smoothly at 60 FPS
  //    - MIRVO_ADDON_FOCUS zooms & spotlights addon parts on ANY of the 12 templates
  //    - Clicking an addon part emits PART_CLICK to parent React viewer
  const addonMetaJson = JSON.stringify(
    addonParts.map((p) => ({
      id: p.id,
      nameUz: p.nameUz,
      svgX: p.svgX,
      svgY: p.svgY,
      zoom: p.zoom,
    }))
  );

  const bridgeScript = `
  <script id="mirvo-addon-bridge">
    (() => {
      const ADDON_PARTS = ${addonMetaJson};
      const ADDON_MAP = Object.fromEntries(ADDON_PARTS.map((p) => [p.id, p]));
      const stageEl = document.querySelector(".mirvo-stage") || document.getElementById("stage");
      const addonLayer = document.getElementById("mirvo-ai-addon-layer");

      // Smooth 60 FPS stroke-dashoffset animation for any .mirvo-addon-flow paths
      const flowEls = Array.from(document.querySelectorAll(".mirvo-addon-flow, #mirvo-ai-addon-layer .water-dash, #mirvo-ai-addon-layer .electric-dash"));
      if (flowEls.length > 0) {
        const t0 = performance.now();
        function tickAddon(now) {
          const sec = (now - t0) / 1000;
          const off = (-sec * 88).toFixed(1);
          for (let i = 0; i < flowEls.length; i++) {
            flowEls[i].setAttribute("stroke-dashoffset", off);
            flowEls[i].style.strokeDashoffset = off + "px";
          }
          requestAnimationFrame(tickAddon);
        }
        requestAnimationFrame(tickAddon);
      }

      function focusAddonPart(partId, customX, customY, customZoom) {
        const meta = ADDON_MAP[partId];
        if (!meta && !Number.isFinite(customX)) return;
        if (window.MirvoScene && typeof window.MirvoScene.setAutoTour === "function") {
          window.MirvoScene.setAutoTour(false);
        }
        const x = Number.isFinite(customX) ? customX : meta.svgX;
        const y = Number.isFinite(customY) ? customY : meta.svgY;
        const z = Math.max(1.0, Math.min(2.8, Number(customZoom || meta?.zoom) || 1.6));

        const allParts = document.querySelectorAll(".mirvo-part");
        allParts.forEach((el) => {
          const match = el.getAttribute("data-part") === partId;
          el.classList.toggle("is-focused", match);
          el.classList.toggle("is-dimmed", !match);
        });

        if (stageEl) {
          const dxPct = ((800 - x) / 1600) * 100;
          const dyPct = ((450 - y) / 900) * 100;
          stageEl.style.transform = \`scale(\${z.toFixed(3)}) translate(\${dxPct.toFixed(2)}%, \${dyPct.toFixed(2)}%)\`;
        }
      }

      window.addEventListener("message", (ev) => {
        const msg = ev && ev.data;
        if (!msg || typeof msg !== "object") return;

        if (msg.type === "MIRVO_ADDON_FOCUS") {
          focusAddonPart(msg.partId, msg.svgX, msg.svgY, msg.zoom);
        } else if (msg.type === "HIGHLIGHT") {
          // Ensure addon parts also dim when an existing template part is highlighted, or clear on null
          const targetId = msg.partId || null;
          if (addonLayer) {
            addonLayer.querySelectorAll(".mirvo-part").forEach((el) => {
              if (!targetId) {
                el.classList.remove("is-dimmed", "is-focused");
              } else {
                const match = el.getAttribute("data-part") === targetId;
                el.classList.toggle("is-focused", match);
                el.classList.toggle("is-dimmed", !match);
              }
            });
          }
        } else if (msg.type === "RESET" || (msg.type === "FOCUS" && msg.target === "full")) {
          if (addonLayer) {
            addonLayer.querySelectorAll(".mirvo-part").forEach((el) => {
              el.classList.remove("is-dimmed", "is-focused");
            });
          }
        }
      });

      if (addonLayer) {
        addonLayer.addEventListener("click", (ev) => {
          const g = ev.target.closest(".mirvo-part");
          if (!g) return;
          ev.stopPropagation();
          const partId = g.getAttribute("data-part");
          const meta = ADDON_MAP[partId];
          if (!meta) return;
          focusAddonPart(partId, meta.svgX, meta.svgY, meta.zoom);
          try {
            window.parent.postMessage(
              { type: "PART_CLICK", partId, nameUz: meta.nameUz },
              "*"
            );
          } catch (_) {}
        });
      }
    })();
  </script>`;

  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, `${bridgeScript}\n</body>`);
  } else {
    html += bridgeScript;
  }

  return html;
}

function buildSceneAdapterSystemPrompt(
  model: SavedHtmlModelEntry,
  stepCount: number
): string {
  const partsList = (model.parts || [])
    .map((p) => `- "${p.id}": ${p.nameUz}`)
    .join('\n');

  return `You are Mirvo AI's Senior Isometric Engineering Architect & Uzbek STEM Educator.
We ALREADY have a museum-grade 2,000-line interactive isometric SVG HTML model for:
MODEL: "${model.titleUz}" (id: "${model.id}", viewBox="0 0 1600 900" on pure #ffffff background).

EXISTING INTERACTIVE PARTS ALREADY DRAWN IN THIS TEMPLATE (data-part IDs):
${partsList}

SPATIAL LAYOUT & CONNECTION COORDINATES OF EXISTING TEMPLATE:
${model.connectionHints || 'Centered inside viewBox="0 0 1600 900" around x=400..1200, y=140..780; open white margins on left x=30..370 and right x=1200..1570.'}

YOUR TASK FOR THE USER'S QUESTION:
Decide cleanly between TWO modes — NEVER rewrite the existing template!

MODE 1: "focus_only"
Choose "focus_only" when the user's question is about how an existing part works, why an internal fluid/component is needed, physics/efficiency/faults inside the already-drawn parts, etc.
- You output ZERO SVG! You only write ${stepCount} crystal-clear Uzbek steps answering the exact question while focusing/highlighting the relevant existing data-part IDs ("full" or one of the IDs above).

MODE 2: "svg_addon"
Choose "svg_addon" ONLY when the user explicitly asks about an EXTERNAL / UPSTREAM / DOWNSTREAM object NOT in the existing parts list (for example: "GESga daryo va to'g'on nega kerak?" -> add "river_dam" connected to the left penstock inlet; "Transformatorga elektr liniyasi (LEP) / iste'molchi qanday ulanadi?" -> add transmission tower/load on right; "IESda gradirnya (sovutish minorasi) nega kerak?" -> add cooling tower on right; "Quyosh stansiyasi uyga qanday tok beradi?" -> add isometric house/meter on right).
Rules for "svg_addon":
1. Create 1 (at most 2) modular addon part(s) in "addonParts" placed in the open white margin specified in SPATIAL LAYOUT so it connects cleanly to the existing machine WITHOUT covering the center unit!
2. Match the EXACT "anatomy" CAD skill visual craft (SKILL.md + craft.md — STRICT):
   - Build the addon like a real multi-part physical assembly (12–25 crisp sub-shapes: stepped foundation/pad, soft ground shadow ellipse fill="#cbd5e1" opacity="0.45", beveled structural body, ribs/creases, bolted flange collar or terminal insulator bushings where it meets the main plant!).
   - Crisp dark technical strokes: class="ink" (stroke="#222933", stroke-width="1.55", stroke-linejoin="round") for outer silhouettes and class="ink-seam" (stroke="#222933", stroke-width="1.0") for inner bevels/creases.
   - Rich 4-tone isometric surfaces (brightest top face, lit left face, medium shade face, deep shadow face) + linearGradients in "defsSvg" with unique IDs prefixed by "addon_".
   - NEVER leave pipes, channels, or wires ending in mid-air: every pipe/penstock/cable must terminate on a bolted flange, valve port, or insulator terminal dot!
   - Include at least one animated flow path with class="mirvo-addon-flow" (fill="none", stroke="#38bdf8" or "#facc15", stroke-width="3.5", stroke-dasharray="16 14", stroke-linecap="round") showing water/steam/electricity flowing between your addon and the template's connection point!
   - Do NOT add messy floating text labels, callout balloons, or cartoon boxes inside SVG — keep pure architectural cutaway visual craft!
3. Set accurate "svgX" (0..1600), "svgY" (0..900), and "zoom" (1.45..2.0) at the visual center of your new addon part so the camera zooms smoothly onto it!
4. Write ${stepCount} Uzbek steps in "steps": start with "full" overview or your new addon part, explain directly WHY it is needed (with natural spoken Uzbek — write formulas in words for TTS, no raw LaTeX symbols in textUz), and step through the connected existing template parts!

RETURN STRICT JSON ONLY (no markdown prose outside JSON):
{
  "mode": "focus_only" | "svg_addon",
  "lessonTitleUz": "Clean Uzbek title answering the user's question",
  "addonParts": [
    {
      "id": "snake_case_id",
      "nameUz": "O‘zbekcha qism nomi",
      "svgX": 220,
      "svgY": 520,
      "zoom": 1.65,
      "defsSvg": "<linearGradient id=\\"addon_grad1\\" x1=\\"0%\\" y1=\\"0%\\" x2=\\"100%\\" y2=\\"100%\\">...</linearGradient>",
      "groupSvg": "<g class=\\"mirvo-part\\" data-part=\\"snake_case_id\\">...</g>"
    }
  ],
  "steps": [
    {
      "titleUz": "Qisqa qadam sarlavhasi",
      "focusPart": "full_or_existing_part_id_or_addon_id",
      "explode": 0,
      "textUz": "Aniq, ravon o‘zbek lotin tilida 1-2 gaplik ilmiy-tushunarli izoh (TTS o‘qishi uchun belgilarsiz)."
    }
  ]
}`;
}

export async function adaptMirvoSceneWithQwen(params: {
  apiKey: string;
  query: string;
  modelId: string;
  stepCount?: number;
  originUrl?: string;
}): Promise<SceneAdaptResult> {
  const { apiKey, query, modelId, stepCount = 5, originUrl } = params;
  const cleanKey = sanitizeQwenApiKey(apiKey);
  const safeSteps = Math.max(4, Math.min(6, Math.round(stepCount)));

  const baseModel = HTML_MODELS_LIBRARY.find((m) => m.id === modelId);
  if (!baseModel || baseModel.kind !== 'mirvo-scene') {
    throw new Error(`Modulli MirvoScene shabloni topilmadi: ${modelId}`);
  }

  const nodeEnv = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  const customBase = nodeEnv?.DASHSCOPE_BASE_URL?.trim();
  const baseUrls = customBase
    ? [customBase.replace(/\/+$/, ''), ...DASHSCOPE_ENDPOINTS]
    : DASHSCOPE_ENDPOINTS;

  const systemPrompt = buildSceneAdapterSystemPrompt(baseModel, safeSteps);
  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Foydalanuvchi savoli: "${query}"\nAsosiy shablon: "${baseModel.titleUz}". Savolga aniq javob beradigan JSON qaytar.`,
    },
  ];

  let lastErr = 'Qwen Scene Adapter bilan bog‘lanib bo‘lmadi.';
  let authenticatedRegion = false;

  for (const baseUrl of baseUrls) {
    if (authenticatedRegion) break;
    let authFailedForRegion = false;

    for (const modelName of ADAPTER_MODELS) {
      if (authFailedForRegion) break;

      for (const disableThinking of [true, false]) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 46_000);

        try {
          const lower = modelName.toLowerCase();
          const isOmni = lower.includes('omni');

          const body: Record<string, unknown> = {
            model: modelName,
            messages,
            stream: true,
            stream_options: { include_usage: true },
            temperature: 0.22,
            max_tokens: 6500,
          };
          if (isOmni) {
            body.modalities = ['text'];
          }
          if (disableThinking) {
            body.enable_thinking = false;
          }

          const resp = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${cleanKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          if (!resp.ok || !resp.body) {
            clearTimeout(timer);
            const errText = await resp.text().catch(() => '');
            lastErr = `${modelName} HTTP ${resp.status}: ${errText.slice(0, 180)}`;
            const isInvalidKey =
              resp.status === 401 ||
              (resp.status === 403 && /invalid_api_key|incorrect api key/i.test(errText));
            if (isInvalidKey) {
              authFailedForRegion = true;
              break;
            }
            authenticatedRegion = true;
            if (resp.status === 400 && disableThinking) continue;
            break;
          }

          authenticatedRegion = true;

        const reader = resp.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let sseBuf = '';
        let rawContent = '';
        let actualModel: string = modelName;
        let finalUsage: DashScopeUsageLike | null = null;

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            sseBuf += decoder.decode(value, { stream: true });
            const lines = sseBuf.split(/\r?\n/);
            sseBuf = lines.pop() || '';

            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line.startsWith('data:')) continue;
              const dataStr = line.slice(5).trim();
              if (!dataStr || dataStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.model) actualModel = String(parsed.model);
                if (parsed.usage) finalUsage = parsed.usage as DashScopeUsageLike;
                const piece = parsed.choices?.[0]?.delta?.content;
                if (typeof piece === 'string') rawContent += piece;
              } catch {
                // ignore partial line
              }
            }
          }
        } finally {
          clearTimeout(timer);
          try {
            reader.releaseLock();
          } catch {}
        }

        const parsedJson = extractJsonObject(rawContent);
        const tokenUsage = usageFromDashScope(
          finalUsage || {
            prompt_tokens: Math.round((systemPrompt.length + query.length) / 3.6),
            completion_tokens: Math.round(rawContent.length / 3.6),
          },
          actualModel
        );

        const rawMode = parsedJson.mode === 'svg_addon' ? 'svg_addon' : 'focus_only';
        const lessonTitleUz =
          typeof parsedJson.lessonTitleUz === 'string' && parsedJson.lessonTitleUz.trim()
            ? parsedJson.lessonTitleUz.trim()
            : baseModel.titleUz;

        const rawAddonList = Array.isArray(parsedJson.addonParts)
          ? parsedJson.addonParts
          : [];
        const cleanAddons: AddonPartSpec[] =
          rawMode === 'svg_addon'
            ? rawAddonList
                .filter(
                  (a): a is Record<string, unknown> =>
                    Boolean(a) &&
                    typeof a === 'object' &&
                    typeof (a as Record<string, unknown>).id === 'string' &&
                    typeof (a as Record<string, unknown>).groupSvg === 'string' &&
                    String((a as Record<string, unknown>).groupSvg).trim().length > 30
                )
                .slice(0, 2)
                .map((a) => ({
                  id: String(a.id)
                    .trim()
                    .replace(/[^a-zA-Z0-9_-]/g, '_'),
                  nameUz: String(a.nameUz || a.id).trim(),
                  svgX: Math.max(40, Math.min(1560, Number(a.svgX) || 240)),
                  svgY: Math.max(60, Math.min(840, Number(a.svgY) || 460)),
                  zoom: Math.max(1.15, Math.min(2.4, Number(a.zoom) || 1.65)),
                  defsSvg: typeof a.defsSvg === 'string' ? a.defsSvg : '',
                  groupSvg: String(a.groupSvg),
                }))
            : [];

        const addonMap = new Map(cleanAddons.map((a) => [a.id, a]));
        const validExistingIds = new Set((baseModel.parts || []).map((p) => p.id));

        const mergedParts: MirvoPartMeta[] = [
          ...cleanAddons.map((a) => ({ id: a.id, nameUz: a.nameUz })),
          ...(baseModel.parts || []),
        ];

        const rawSteps = Array.isArray(parsedJson.steps) ? parsedJson.steps : [];
        const cleanSteps: MirvoLessonStep[] = rawSteps
          .filter(
            (s): s is Record<string, unknown> =>
              Boolean(s) && typeof s === 'object' && typeof (s as Record<string, unknown>).textUz === 'string'
          )
          .slice(0, 8)
          .map((s, idx) => {
            const rawFocus = String(s.focusPart || 'full').trim();
            const addon = addonMap.get(rawFocus);
            const focusPart =
              addon || validExistingIds.has(rawFocus) || rawFocus === 'full'
                ? rawFocus
                : 'full';
            return {
              titleUz: String(s.titleUz || `${idx + 1}-qadam`).trim(),
              textUz: String(s.textUz).trim(),
              focusPart,
              isAddonPart: Boolean(addon),
              svgX: addon?.svgX,
              svgY: addon?.svgY,
              zoom: addon?.zoom,
              explode: Number(s.explode) > 0.3 ? 1 : 0,
            };
          });

        const finalSteps =
          cleanSteps.length >= 2
            ? cleanSteps
            : baseModel.defaultSteps || [
                {
                  titleUz: baseModel.titleUz,
                  textUz: baseModel.subtitleUz,
                  focusPart: 'full',
                },
              ];

        if (cleanAddons.length > 0) {
          const originalHtml = await loadTemplateHtml(baseModel, originUrl);
          const patchedHtml = patchModularHtmlWithAddon(originalHtml, cleanAddons);
          return {
            mode: 'svg_addon',
            baseModelId: baseModel.id,
            lessonTitleUz,
            patchedHtml,
            parts: mergedParts,
            steps: finalSteps,
            modelUsed: actualModel,
            tokenUsage,
          };
        }

        return {
          mode: 'focus_only',
          baseModelId: baseModel.id,
          lessonTitleUz,
          publicPath: baseModel.publicPath,
          parts: baseModel.parts || [],
          steps: finalSteps,
          modelUsed: actualModel,
          tokenUsage,
        };
        } catch (err: unknown) {
          clearTimeout(timer);
          lastErr = err instanceof Error ? err.message : String(err);
        }
      }
    }
  }

  throw new Error(`Shablonni moslashtirishda xatolik: ${lastErr}`);
}
