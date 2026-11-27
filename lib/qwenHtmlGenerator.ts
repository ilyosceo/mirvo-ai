import type { Response } from 'express';
import type { TokenUsageInfo } from '../types/tutor.js';
import { usageFromDashScope, type DashScopeUsageLike } from './tokenUsage.js';

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
  // If model ignored continuation and restarted an entire complete document, use the fresh complete doc
  if (/^\s*<!doctype\s+html/i.test(delta) && /<\/html>/i.test(delta)) {
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

  const systemPrompt = buildGoldStandardHtmlSystemPrompt(stepCount);
  const userPrompt = `Mavzu / Qurilma: "${query}". Aynan shu qurilmaning haqiqiy ichki mexanizmlari ko'rinadigan 30° izometrik 2D SVG kesma modeli, 60 FPS jonli fizik animatsiyasi, ${stepCount} bosqichli smooth viewBox zum kamera tushuntirishi va o'zbekcha ovozli darsini 0 dan to'liq bitta standalone HTML fayl sifatida yarat. Kodni ixcham protsedurali JS funksiyalar (~18-28 KB) bilan yoz, hech qanday qisqartirish yoki placeholder qo'yma va </html> bilan to'liq yakunla!`;

  const isContinuation = continueFrom.trim().length > 0;
  const fullPrefix =
    continueFrom.length > 90_000 ? continueFrom.slice(-90_000) : continueFrom;

  type ChatMsg = { role: string; content: string; partial?: boolean };
  const baseMessages: ChatMsg[] = [
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
            pass >= 5
              ? 'Continue strictly from the EXACT last character of your assistant message above without repeating anything, finish the remaining STEPS + audio player concisely, and close with </script></body></html>.'
              : 'Continue strictly from the EXACT last character of your assistant message above. Output ONLY the remaining raw HTML/JS characters to finish through </html>. Do NOT restart from <!DOCTYPE html>, do NOT repeat any code, and do NOT wrap in ``` fences.',
        },
      ]
    : baseMessages;

  sendSse(res, 'status', {
    message:
      pass > 1
        ? `HTML kodi uzluksiz davom ettirilmoqda (${pass}-bosqich)...`
        : 'Qwen 4 Max izometrik HTML kodini 0 dan yozmoqda...',
    pass,
  });

  let lastErrMsg = 'Qwen API bilan bog‘lanib bo‘lmadi.';
  let primaryIntlErr = '';

  for (const baseUrl of baseUrls) {
    for (const modelName of modelsToTry) {
      const attemptVariants: Array<{ label: string; msgs: ChatMsg[] }> = isContinuation
        ? [
            { label: 'partial', msgs: partialMessages },
            { label: 'continue-turn', msgs: fallbackContinueMessages },
          ]
        : [{ label: 'fresh', msgs: baseMessages }];

      let authFailedForEndpoint = false;

      for (const variant of attemptVariants) {
        const remainingMs = Math.max(8_000, maxRunMs - (Date.now() - startTime));
        if (remainingMs <= 8_500 && variant.label === 'continue-turn') {
          break;
        }
        const controller = new AbortController();
        const abortTimer = setTimeout(() => controller.abort(), remainingMs);

        try {
          const lowerModel = modelName.toLowerCase();
          const isOmni = lowerModel.includes('omni');
          const supportsThinking = isOmni || lowerModel.includes('qwen3.5');
          const body: Record<string, unknown> = {
            model: modelName,
            messages: variant.msgs,
            stream: true,
            stream_options: { include_usage: true },
            temperature: isContinuation ? 0.15 : 0.25,
            max_tokens: lowerModel.includes('qwen4') ? 32768 : 16384,
          };
          if (isOmni) {
            body.modalities = ['text'];
          }
          if (supportsThinking) {
            if (pass === 1 && !isContinuation) {
              body.enable_thinking = true;
              body.thinking_budget = 1200;
            } else {
              body.enable_thinking = false;
            }
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
            if (resp.status === 401 || resp.status === 403) {
              authFailedForEndpoint = true;
              break; // try next region endpoint
            }
            // If DashScope rejects partial:true on this model (HTTP 400), immediately retry non-partial variant!
            if (variant.label === 'partial' && resp.status === 400) {
              continue;
            }
            break; // try next model
          }

          sendSse(res, 'status', {
            message:
              pass > 1
                ? `${modelName} kodni davom ettirmoqda (${pass}-bosqich)...`
                : `${modelName} orqali jonli HTML generatsiya qilinmoqda...`,
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
                        message: `${actualModel} izometrik HTML kodini yozmoqda (${pass}-bosqich)...`,
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

          const combinedRaw = stitchHtmlContinuation(continueFrom, deltaAccum);
          const hasClosingHtml = /<\/html>/i.test(combinedRaw);
          const tokenUsage: TokenUsageInfo = finalUsage
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

          if (hasClosingHtml) {
            const cleanHtml = cleanStreamedHtml(combinedRaw);
            sendSse(res, 'done', {
              html: cleanHtml,
              model: actualModel,
              token_usage: tokenUsage,
              elapsedMs: Date.now() - startTime,
            });
            res.end();
            return;
          }

          if (deltaAccum.length > 20 && (timedOutSoft || finishedNormally)) {
            sendSse(res, 'partial', {
              htmlSoFar: combinedRaw.replace(/^```(?:html)?\s*/i, ''),
              model: actualModel,
              token_usage: tokenUsage,
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
