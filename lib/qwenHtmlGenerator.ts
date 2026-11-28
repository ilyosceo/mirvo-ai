import type { Response } from 'express';
import { cleanTopicTitleUz } from '../data/htmlModelsLibrary.js';
import type { TokenUsageInfo } from '../types/tutor.js';
import {
  buildAnatomySkillSystemPrompt,
  SCENE_END_MARKER,
  validateAndAssembleAnatomyHtml,
} from './qwenAnatomySkillPack.js';
import {
  mergeTokenUsage,
  usageFromDashScope,
  type DashScopeUsageLike,
} from './tokenUsage.js';

const DASHSCOPE_ENDPOINTS = [
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  'https://dashscope-us.aliyuncs.com/compatible-mode/v1',
  'https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1',
  'https://dashscope.aliyuncs.com/compatible-mode/v1',
];

const DEFAULT_HTML_MODELS = [
  'qwen4-max',
  'qwen3.5-plus',
  'qwen3.8-omni-flash',
  'qwen-plus',
] as const;

export function sanitizeQwenApiKey(raw: string): string {
  return (raw || '')
    .trim()
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(/^Bearer\s+/i, '')
    .replace(/[\r\n]+/g, '')
    .trim();
}

export function buildGoldStandardHtmlSystemPrompt(stepCount = 5): string {
  const safeSteps = Math.max(4, Math.min(6, stepCount));
  return `You are an elite technical CAD illustrator and interactive STEM educator building standalone, single-file interactive HTML lessons in Uzbek (Lotin alifbosi).

TARGET QUALITY STANDARD (MUST MATCH THIS EXACT ARCHITECTURE & VISUAL CRAFT):
Build ONE complete, self-contained HTML5 document (<!DOCTYPE html>...</html>) with ZERO external CDN links, ZERO external libraries, ZERO placeholder comments, and ZERO shortcuts.

VISUAL & LAYOUT RULES (STRICT):
1. Minimalist Technical Paper Aesthetic:
   - Page background: radial-gradient(circle at 50% 45%, #ffffff 0%, #fafafa 62%, #f3f4f6 100%).
   - Clean 3-band full-viewport layout (.app-shell):
     a) Ultra-minimal top bar (height: 54px): ONLY the Uzbek lesson title on the left and a crisp white pill step counter ("1 / ${safeSteps}") on the right. NO extra toolbar buttons, NO badges, NO emoji characters.
     b) Center SVG stage (~85% of viewport): ONE large crisp <svg id="sceneSvg" viewBox="..."> showing an architectural 30° isometric cutaway of the requested machine/device/system.
     c) Bottom floating dock (.bottom-dock):
        - Dark crisp subtitle pill (background: rgba(17, 24, 39, 0.92), color: #ffffff, max-width: 680px, border-radius: 14px).
        - Pure white high-contrast floating audio player pill (.player-pill, background: #ffffff, border: 1px solid #e5e7eb, dark #1f2937 icons, blue #2563eb primary "Eshitish" / "Pauza" button, ${safeSteps} clickable step dots, prev/replay/next/mute buttons, and speed toggle "1.0x" / "1.2x" / "0.85x").
2. Exact 30° Mathematical Isometric Cutaway Geometry (NO sloppy flat cartoons & NO boxy Lego brick pillars!):
   - Implement exact mathematical projection & curved engineering helpers in <script>:
     - COS30 = Math.cos(Math.PI / 6), SIN30 = 0.5
     - iso(x, y, z) -> [OX + (x - y) * COS30 * SCALE, OY + (x + y) * SIN30 * SCALE - z * SCALE]
     - isoBox(x0, x1, y0, y1, z0, z1, palName, opts) ONLY for true rectangular frames/plates/displays — NEVER use plain rectangular boxes to fake copper coils, round housings, pistons, or pipes!
     - isoFrustumZ(cx, cy, rBot, rTop, z0, z1, palName, steps, opts) for vertical cylinders, tapered cones/nozzles, stepped shafts, pistons, and 240° cutaway cylindrical pressure vessels/domes (pass arcStart/arcEnd so front 120° is cut open with thick beveled cutaway wall edges exposing internal rotors/pistons/valves!).
     - isoHelixCoilZ(cx, cy, rCoil, z0, z1, turns, strokeHex, highlightHex, wireWidth) for genuine 3D helical copper windings, stator coils, springs, and heat-exchange spirals!
     - isoTube3D(points3D, strokeWidth, outerHex, highlightHex) for smooth bent suction/discharge pipes, manifolds, and fluid conduits!
     - isoCirclePts(cx, cy, r, z, steps) and radial blade/fin/gear loops so every internal part is unmistakably recognizable as the EXACT requested machine!
   - Architectural material palettes:
     - shell: #ffffff / #f4f5f7 / #e6e8ec
     - cavity: #f9fafb / #eef0f4 / #dfe3ea
     - steel: #f3f4f6 / #e2e6ec / #d1d5db
     - dark: #4b5563 / #374151 / #1f2937
     - copper: #e59866 / #d47a44 / #b85c2a
     - water / coolant / waves: #38bdf8 / #0284c7 / #e0f2fe
     - heat / energy accents: #f59e0b / #ef4444 / #2563eb
   - Strict back-to-front painter's order (<g id="layerShadow">, back shell walls, internal back cavity, dynamic moving parts, cutaway partition walls, internal core components, front cutaway bezel/glass/controls).
   - NEVER wash out or dim inactive parts — keep all parts crisp and legible! Use only a subtle dashed blue highlight ring (.part-highlight, stroke: #2563eb, stroke-dasharray: 5 4) on the active assembly (.is-active).
3. Live 60 FPS Physical Animations (requestAnimationFrame):
   - Animate the real working physics of the device smoothly at 60 FPS (e.g., spinning fans/rotors/turbines/gears, reciprocating pistons/valves, animated fluid/gas/electric/electromagnetic wave flow along paths, glowing heating elements/plasma/arcs, moving molecules or gauge needles).
   - Make major internal assemblies clickable (.clickable-part with data-step="2"..) so clicking any component zooms to its lesson step!
4. ${safeSteps} Concise Uzbek Lesson Steps + Smooth Cubic-Eased Camera Zoom + Narration:
   - Define const STEPS = [ ... ] with exactly ${safeSteps} steps:
     - Step 1: Wide overview of the entire cutaway device + clear Uzbek overview explanation.
     - Steps 2..${safeSteps}: Smooth cubic-eased SVG viewBox camera zoom directly onto each major real functional sub-assembly of this specific device, with clear engineering explanation in natural Uzbek (Lotin).
   - Implement browser SpeechSynthesis narration (uz-UZ -> tr -> ru fallback) with reliable fallback setTimeout auto-advance so clicking "Eshitish" smoothly narrates and advances through all ${safeSteps} steps, plus keyboard shortcuts (ArrowLeft, ArrowRight, Space).
5. OUTPUT FORMAT & COMPACT PROCEDURAL CRAFT (CRITICAL):
   - Output ONLY raw HTML starting immediately with <!DOCTYPE html> and ending cleanly with </html>.
   - Do NOT wrap in markdown code fences (\`\`\`html). Do NOT add explanations before or after the HTML.
   - Write EVERY SINGLE LINE completely — never abbreviate or leave TODOs!
   - Keep the file clean, smart, and procedural (~18 KB to 28 KB total, ~380 to 620 lines): use reusable JS helper functions (isoBox, isoCylinderZ, loops for cooling fins/gears/coils/waves) instead of hundreds of repetitive hardcoded SVG paths so the entire standalone HTML finishes cleanly and runs smoothly at 60 FPS.`;
}

export function cleanStreamedHtml(raw: string): string {
  let out = (raw || '').trim();
  // Strip optional leading ```html fence if model included one
  out = out.replace(/^```(?:html)?\s*/i, '');
  out = out.replace(/\s*```$/i, '');
  const docStart = out.search(/<!doctype\s+html|<html/i);
  if (docStart > 0) {
    out = out.slice(docStart);
  }
  const htmlEnd = out.toLowerCase().lastIndexOf('</html>');
  if (htmlEnd >= 0) {
    out = out.slice(0, htmlEnd + 7);
  }
  return out.trim();
}

function stitchHtmlContinuation(prev: string, rawDelta: string): string {
  if (!prev) return rawDelta;
  let delta = rawDelta.replace(/^```(?:html|javascript|js|css)?\s*\r?\n?/i, '');
  // If model ignored continuation and restarted an entire complete document or complete Anatomy scene, use the fresh complete output
  if (/^\s*<!doctype\s+html/i.test(delta) && /<\/html>/i.test(delta)) {
    return delta;
  }
  if (
    /^\s*window\.buildMirvoAnatomyScene\s*=/.test(delta) &&
    delta.includes(SCENE_END_MARKER)
  ) {
    return delta;
  }
  // Remove accidental overlap between the tail of prev and the head of delta (up to 400 chars)
  const maxCheck = Math.min(400, prev.length, delta.length);
  for (let len = maxCheck; len >= 16; len--) {
    if (prev.endsWith(delta.slice(0, len))) {
      delta = delta.slice(len);
      break;
    }
  }
  return prev + delta;
}

async function repairAnatomySceneOnce(opts: {
  baseUrl: string;
  cleanKey: string;
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  brokenJs: string;
  errorMessage: string;
  timeoutMs: number;
}): Promise<{ fixedJs: string; usage: TokenUsageInfo } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const isOmni = opts.modelName.toLowerCase().includes('omni');
    const body: Record<string, unknown> = {
      model: opts.modelName,
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: opts.userPrompt },
        { role: 'assistant', content: opts.brokenJs },
        {
          role: 'user',
          content: `Your JavaScript scene threw this runtime error during ANATOMY sandbox validation:\n${opts.errorMessage}\n\nFix the bug and output the COMPLETE corrected JavaScript starting with window.buildMirvoAnatomyScene = function({ k, G, T }) { and ending with ${SCENE_END_MARKER}. Do NOT wrap in markdown fences.`,
        },
      ],
      stream: false,
      temperature: 0.15,
      max_tokens: 12000,
      enable_thinking: false,
    };
    if (isOmni) body.modalities = ['text'];

    const resp = await fetch(`${opts.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.cleanKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
      usage?: DashScopeUsageLike;
    };
    const content = json.choices?.[0]?.message?.content || '';
    if (!content.includes('buildMirvoAnatomyScene')) return null;
    const usage = usageFromDashScope(json.usage || null, json.model || opts.modelName);
    return { fixedJs: content, usage };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface StreamHtmlParams {
  apiKey: string;
  query: string;
  stepCount: number;
  continueFrom?: string;
  pass?: number;
  res: Response;
  maxRunMs?: number;
}

function sendSse(res: Response, event: string, payload: unknown): void {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export async function streamQwenHtmlLesson(params: StreamHtmlParams): Promise<void> {
  const {
    apiKey,
    query,
    stepCount,
    continueFrom = '',
    pass = 1,
    res,
    maxRunMs = 51_000,
  } = params;

  const cleanKey = sanitizeQwenApiKey(apiKey);
  const startTime = Date.now();
  const nodeEnv = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  const preferredModel = nodeEnv?.QWEN_HTML_MODEL?.trim() || nodeEnv?.QWEN_MODEL?.trim();
  const modelsToTry = preferredModel
    ? [preferredModel, ...DEFAULT_HTML_MODELS.filter((m) => m !== preferredModel)]
    : [...DEFAULT_HTML_MODELS];

  const customBase = nodeEnv?.DASHSCOPE_BASE_URL?.trim();
  const baseUrls = customBase
    ? [customBase.replace(/\/+$/, ''), ...DASHSCOPE_ENDPOINTS]
    : DASHSCOPE_ENDPOINTS;

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const cleanTitle = cleanTopicTitleUz(query);
  const systemPrompt = buildAnatomySkillSystemPrompt(stepCount);
  const userPrompt = `Mavzu / Tushuncha / Qurilma: "${query}".
"anatomy" CAD dvigateli (window.ANATOMY = { k, G, T }) qoidalariga qat'iy amal qilib, ushbu mavzuni tushuntiruvchi 40–75 ta aniq 3D detaldan iborat haqiqiy izometrik kesma qurilma yoki laboratoriya stendini yarat:
1) Neytral asos plitasi (k.haloOf, 4 ta oyoqcha, faskali k.slabOf, perimetr ariqchasi, burchak vintlari va shkalali o'lchov chizg'ichi k.topTicks);
2) Mavzuning haqiqiy ishlash fizikasini ko'rsatuvchi burama mexanizmlar (G.frameAlong + G.solidOf / G.lathe / G.disc / G.ringBand / G.sphereOf), sovutish qovurg'alari (G.ribsOf), flanes murvatlari (G.dotsOf), prujina yoki mis chulg'amlar (k.coil — orqa va old qismini ajratib), silliq 3D quvurlar (G.fillet + T.tubePieces + T.tubeSvg) hamda jonli analog o'lchov pribori (k.radialTicks + strelka) va oqim chiziqlari (flow: true);
3) 4 yoki 5 ta rangli interaktiv uzel (<g class="mirvo-part" data-part="..." data-mat="cobalt|copper|bronze|water|steel|amber|emerald|dark">), aniq "parts" metama'lumotlari (focusAt va explode vektorlari bilan), aynan ${stepCount} ta tabiiy o'zbekcha ovozli dars qadami ("steps") va 60 FPS "onTick(tSec, activeStepIdx)" fizik animatsiyasi.
Faqat toza JavaScript kodini (window.buildMirvoAnatomyScene = function({ k, G, T }) { ... };) chiqar va oxirini ${SCENE_END_MARKER} bilan yakunla!`;

  const repairMarkerMatch = continueFrom.match(/\/\*\s*MIRVO_REPAIR_ERROR:\s*([\s\S]*?)\s*\*\/\s*$/);
  const isRepairPass = Boolean(repairMarkerMatch);
  const rawContinueBody = isRepairPass
    ? continueFrom.replace(/\/\*\s*MIRVO_REPAIR_ERROR:[\s\S]*?\*\/\s*$/, '').trim()
    : continueFrom;
  const isContinuation = rawContinueBody.trim().length > 0 && !isRepairPass;
  const fullPrefix =
    rawContinueBody.length > 90_000 ? rawContinueBody.slice(-90_000) : rawContinueBody;

  type ChatMsg = { role: string; content: string; partial?: boolean };
  const baseMessages: ChatMsg[] = isRepairPass
    ? [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: fullPrefix },
        {
          role: 'user',
          content: `Your JavaScript scene threw this runtime error during ANATOMY sandbox validation:\n${repairMarkerMatch?.[1] || 'Runtime error'}\n\nFix the bug and output the COMPLETE corrected JavaScript starting with window.buildMirvoAnatomyScene = function({ k, G, T }) { and ending with ${SCENE_END_MARKER}. Do NOT wrap in markdown fences.`,
        },
      ]
    : [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

  const partialMessages: ChatMsg[] = isContinuation
    ? [...baseMessages, { role: 'assistant', content: fullPrefix, partial: true }]
    : baseMessages;

  const fallbackContinueMessages: ChatMsg[] = isContinuation
    ? [
        ...baseMessages,
        { role: 'assistant', content: fullPrefix },
        {
          role: 'user',
          content:
            pass >= 4
              ? `Continue strictly from the EXACT last character of your assistant message above without repeating anything, finish parts, steps, onTick, and return { P, W, H, staticSvg, parts, steps, onTick }; then close with ${SCENE_END_MARKER}.`
              : `Continue strictly from the EXACT last character of your assistant message above. Output ONLY the remaining raw JavaScript characters to finish window.buildMirvoAnatomyScene through ${SCENE_END_MARKER}. Do NOT restart from the beginning, do NOT repeat any code, and do NOT wrap in \`\`\` fences.`,
        },
      ]
    : baseMessages;

  sendSse(res, 'status', {
    message:
      pass > 1
        ? `Anatomy 3D CAD sahnasi davom ettirilmoqda (${pass}-bosqich)...`
        : 'Qwen 4 Max + Anatomy CAD skill orqali 3D izometrik qurilma yaratilmoqda...',
    pass,
  });

  let lastErrMsg = 'Qwen API bilan bog‘lanib bo‘lmadi.';
  let primaryIntlErr = '';
  let authenticatedRegion = false;

  for (const baseUrl of baseUrls) {
    if (authenticatedRegion) {
      // Once we confirmed the API key works on a regional endpoint (e.g. Singapore),
      // NEVER jump to other regions (US/HK/Beijing) which would return misleading 401 errors!
      break;
    }

    for (const modelName of modelsToTry) {
      if (Date.now() - startTime >= maxRunMs - 5000) {
        break;
      }

      const attemptVariants: Array<{
        label: string;
        msgs: ChatMsg[];
        disableThinking: boolean;
        maxTokens: number;
      }> = isContinuation
        ? [
            { label: 'partial', msgs: partialMessages, disableThinking: true, maxTokens: 16384 },
            {
              label: 'continue-turn',
              msgs: fallbackContinueMessages,
              disableThinking: true,
              maxTokens: 16384,
            },
          ]
        : [
            { label: 'fast-no-think', msgs: baseMessages, disableThinking: true, maxTokens: 16384 },
            { label: 'compat-8k', msgs: baseMessages, disableThinking: false, maxTokens: 8192 },
          ];

      let authFailedForEndpoint = false;

      for (const variant of attemptVariants) {
        const remainingMs = maxRunMs - (Date.now() - startTime);
        if (remainingMs <= 5000) {
          break;
        }
        const controller = new AbortController();
        const abortTimer = setTimeout(() => controller.abort(), remainingMs);

        try {
          const lowerModel = modelName.toLowerCase();
          const isOmni = lowerModel.includes('omni');
          const body: Record<string, unknown> = {
            model: modelName,
            messages: variant.msgs,
            stream: true,
            stream_options: { include_usage: true },
            temperature: isContinuation ? 0.15 : 0.25,
            max_tokens: variant.maxTokens,
          };
          if (isOmni) {
            body.modalities = ['text'];
          }
          if (variant.disableThinking) {
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
            clearTimeout(abortTimer);
            const errText = await resp.text().catch(() => '');
            const endpointHost = (() => {
              try {
                return new URL(baseUrl).host;
              } catch {
                return baseUrl;
              }
            })();
            const msg = `${endpointHost} (${modelName}) HTTP ${resp.status}: ${errText.slice(0, 180)}`;
            lastErrMsg = msg;
            if (!primaryIntlErr && baseUrl.includes('dashscope-intl')) {
              primaryIntlErr = msg;
            }
            const isInvalidKey =
              resp.status === 401 ||
              (resp.status === 403 && /invalid_api_key|incorrect api key/i.test(errText));
            if (isInvalidKey) {
              authFailedForEndpoint = true;
              break; // try next region endpoint
            }
            // Key IS valid for this region! Lock onto this region so we never get fake 401s elsewhere.
            authenticatedRegion = true;

            // If HTTP 400 (e.g. model rejected partial:true or enable_thinking or max_tokens:16384), retry fallback variant!
            if (resp.status === 400) {
              continue;
            }
            break; // e.g. 404 model_not_found or 403 model unpurchased -> try next model on SAME region
          }

          // 200 OK -> lock onto this region permanently for this request!
          authenticatedRegion = true;

          sendSse(res, 'status', {
            message:
              pass > 1
                ? `${modelName} Anatomy CAD kodini davom ettirmoqda (${pass}-bosqich)...`
                : `${modelName} + Anatomy CAD skill orqali sahna chizilmoqda...`,
            model: modelName,
            pass,
          });

          const reader = resp.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let sseBuffer = '';
          let deltaAccum = '';
          let chunkBuffer = '';
          let reasoningChars = 0;
          let lastReasoningPulseAt = 0;
          let announcedWriting = false;
          let actualModel = modelName;
          let finalUsage: DashScopeUsageLike | null = null;
          let finishedNormally = false;
          let timedOutSoft = false;

          try {
            while (true) {
              if (Date.now() - startTime >= maxRunMs - 1500) {
                timedOutSoft = true;
                controller.abort();
                break;
              }
              const { value, done } = await reader.read();
              if (done) {
                finishedNormally = true;
                break;
              }
              sseBuffer += decoder.decode(value, { stream: true });
              const lines = sseBuffer.split(/\r?\n/);
              sseBuffer = lines.pop() || '';

              for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line.startsWith('data:')) continue;
                const dataStr = line.slice(5).trim();
                if (!dataStr || dataStr === '[DONE]') {
                  finishedNormally = true;
                  continue;
                }
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.error) {
                    const errMsg =
                      typeof parsed.error === 'object' && parsed.error?.message
                        ? String(parsed.error.message)
                        : JSON.stringify(parsed.error);
                    lastErrMsg = `${actualModel} stream error: ${errMsg}`;
                    finishedNormally = false;
                    break;
                  }
                  if (parsed.model) actualModel = String(parsed.model);
                  if (parsed.usage) {
                    finalUsage = parsed.usage as DashScopeUsageLike;
                  }
                  const reasoningPiece = parsed.choices?.[0]?.delta?.reasoning_content;
                  if (typeof reasoningPiece === 'string' && reasoningPiece.length > 0) {
                    reasoningChars += reasoningPiece.length;
                    const now = Date.now();
                    if (now - lastReasoningPulseAt >= 1200) {
                      lastReasoningPulseAt = now;
                      sendSse(res, 'status', {
                        message: `${actualModel} izometrik geometriyani rejalashtirmoqda... (${reasoningChars.toLocaleString()} belgi tahlil)`,
                        model: actualModel,
                        pass,
                      });
                    }
                  }
                  const piece = parsed.choices?.[0]?.delta?.content;
                  if (typeof piece === 'string' && piece.length > 0) {
                    if (!announcedWriting) {
                      announcedWriting = true;
                      sendSse(res, 'status', {
                        message: `${actualModel} Anatomy 3D CAD detallarini yig‘moqda (${pass}-bosqich)...`,
                        model: actualModel,
                        pass,
                      });
                    }
                    deltaAccum += piece;
                    chunkBuffer += piece;
                    if (chunkBuffer.length >= 260) {
                      const combinedLen = continueFrom.length + deltaAccum.length;
                      const combinedLines = (continueFrom + deltaAccum).split('\n').length;
                      sendSse(res, 'chunk', {
                        text: chunkBuffer,
                        totalChars: combinedLen,
                        totalLines: combinedLines,
                      });
                      chunkBuffer = '';
                    }
                  }
                } catch {
                  // ignore partial SSE JSON frames
                }
              }
            }
          } catch (readErr: unknown) {
            if (timedOutSoft || (readErr instanceof Error && readErr.name === 'AbortError')) {
              timedOutSoft = true;
            } else {
              throw readErr;
            }
          } finally {
            clearTimeout(abortTimer);
            try {
              reader.releaseLock();
            } catch {}
          }

          if (chunkBuffer.length > 0) {
            sendSse(res, 'chunk', {
              text: chunkBuffer,
              totalChars: continueFrom.length + deltaAccum.length,
              totalLines: (continueFrom + deltaAccum).split('\n').length,
            });
          }

          const combinedRaw = isRepairPass
            ? deltaAccum
            : stitchHtmlContinuation(rawContinueBody, deltaAccum);
          const hasAnatomyMarker = combinedRaw.includes(SCENE_END_MARKER);
          const looksCompleteAnatomy =
            hasAnatomyMarker ||
            (finishedNormally &&
              !timedOutSoft &&
              combinedRaw.includes('buildMirvoAnatomyScene') &&
              /return\s*\{[\s\S]*staticSvg[\s\S]*\}[\s\S]*\};?\s*$/.test(combinedRaw.trim()));
          const hasClosingHtml = /<\/html>/i.test(combinedRaw);
          let totalUsage: TokenUsageInfo = finalUsage
            ? usageFromDashScope(finalUsage, actualModel)
            : usageFromDashScope(
                {
                  prompt_tokens: Math.round(
                    variant.msgs.reduce((acc, m) => acc + m.content.length, 0) / 3.6
                  ),
                  completion_tokens: Math.round(deltaAccum.length / 3.6),
                },
                actualModel
              );

          if (looksCompleteAnatomy) {
            try {
              const assembled = validateAndAssembleAnatomyHtml(cleanTitle, combinedRaw);
              sendSse(res, 'done', {
                html: assembled.html,
                kind: 'mirvo-scene',
                parts: assembled.parts,
                steps: assembled.steps,
                model: actualModel,
                token_usage: totalUsage,
                elapsedMs: Date.now() - startTime,
              });
              res.end();
              return;
            } catch (valErr: unknown) {
              const errMsg = valErr instanceof Error ? valErr.message : String(valErr);
              const leftMs = maxRunMs - (Date.now() - startTime);
              if (leftMs >= 14_000) {
                sendSse(res, 'status', {
                  message: `${actualModel} Anatomy CAD geometriyadagi xatoni avtomatik tuzatmoqda...`,
                  model: actualModel,
                  pass,
                });
                const repaired = await repairAnatomySceneOnce({
                  baseUrl,
                  cleanKey,
                  modelName: actualModel,
                  systemPrompt,
                  userPrompt,
                  brokenJs: combinedRaw,
                  errorMessage: errMsg,
                  timeoutMs: leftMs - 1500,
                });
                if (repaired) {
                  totalUsage = mergeTokenUsage(totalUsage, repaired.usage);
                  const assembled = validateAndAssembleAnatomyHtml(cleanTitle, repaired.fixedJs);
                  sendSse(res, 'done', {
                    html: assembled.html,
                    kind: 'mirvo-scene',
                    parts: assembled.parts,
                    steps: assembled.steps,
                    model: actualModel,
                    token_usage: totalUsage,
                    elapsedMs: Date.now() - startTime,
                  });
                  res.end();
                  return;
                }
              } else if (pass <= 3) {
                sendSse(res, 'partial', {
                  htmlSoFar: `${combinedRaw}\n/* MIRVO_REPAIR_ERROR: ${errMsg.replace(/\*\//g, '')} */`,
                  model: actualModel,
                  token_usage: totalUsage,
                  pass,
                  deltaChars: deltaAccum.length,
                });
                res.end();
                return;
              }
              lastErrMsg = `Anatomy CAD tekshiruvi xatosi: ${errMsg}`;
              break;
            }
          }

          if (hasClosingHtml) {
            const cleanHtml = cleanStreamedHtml(combinedRaw);
            sendSse(res, 'done', {
              html: cleanHtml,
              kind: 'self-contained',
              model: actualModel,
              token_usage: totalUsage,
              elapsedMs: Date.now() - startTime,
            });
            res.end();
            return;
          }

          if (
            deltaAccum.length > 20 &&
            !looksCompleteAnatomy &&
            (timedOutSoft || finishedNormally)
          ) {
            sendSse(res, 'partial', {
              htmlSoFar: combinedRaw.replace(/^```(?:html|javascript|js)?\s*/i, ''),
              model: actualModel,
              token_usage: totalUsage,
              pass,
              deltaChars: deltaAccum.length,
            });
            res.end();
            return;
          }
        } catch (err: unknown) {
          clearTimeout(abortTimer);
          lastErrMsg = err instanceof Error ? err.message : String(err);
        }
      }

      if (authFailedForEndpoint) {
        break;
      }
    }
  }

  const finalDiagnostic = primaryIntlErr || lastErrMsg;
  const authHint =
    /HTTP 401|invalid_api_key/i.test(finalDiagnostic)
      ? ' — Vercel Environment Variables ichidagi QWEN_API_KEY qiymatini yangilab, Redeploy qiling.'
      : '';
  sendSse(res, 'error', {
    error: `Qwen HTML generatsiyasi muvaffaqiyatsiz tugadi: ${finalDiagnostic}${authHint}`,
  });
  res.end();
}
