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
  'qwen3.8-omni-flash',
  'qwen3.5-plus',
  'qwen-plus',
  'qwen3.5-omni-flash',
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
2. Exact 30° Mathematical Isometric Cutaway Geometry (NO sloppy flat cartoons!):
   - Implement exact mathematical projection functions in <script>:
     - COS30 = Math.cos(Math.PI / 6), SIN30 = 0.5
     - iso(x, y, z) -> [OX + (x - y) * COS30 * SCALE, OY + (x + y) * SIN30 * SCALE - z * SCALE]
     - isoBox(x0, x1, y0, y1, z0, z1, palName, opts) with 4-tone shaded faces (+z top brightest, +y left-front mid, +x right-front shaded) and crisp #1f2937 technical ink strokes (stroke-width: 1.05px outer, 0.7px inner details, 0.6px faint seams).
     - isoCylinderZ(cx, cy, r, z0, z1, palName, steps, opts) for real vertical cylinders, shafts, rotors, coils, pistons, pipes, dials.
     - isoCirclePts(cx, cy, r, z, steps) and custom angled tubes / cooling fins / gears / coils / cutaway housing walls so internal engineering mechanisms are genuinely exposed and immediately recognizable as the EXACT requested device!
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
5. OUTPUT FORMAT (CRITICAL):
   - Output ONLY raw HTML starting immediately with <!DOCTYPE html> and ending cleanly with </html>.
   - Do NOT wrap in markdown code fences (\`\`\`html). Do NOT add explanations before or after the HTML.
   - Write EVERY SINGLE LINE of CSS, SVG definitions, geometry builder, animation loop, and controls completely — never abbreviate or leave TODOs!`;
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
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Mavzu / Qurilma: "${query}". Aynan shu qurilmaning haqiqiy ichki mexanizmlari ko'rinadigan 30° izometrik 2D SVG kesma modeli, 60 FPS jonli fizik animatsiyasi, ${stepCount} bosqichli smooth viewBox zum kamera tushuntirishi va o'zbekcha ovozli darsini 0 dan to'liq bitta standalone HTML fayl sifatida yarat. Hech qanday qisqartirish yoki placeholder qo'yma!`,
    },
  ];

  if (continueFrom.trim().length > 0) {
    const tail = continueFrom.slice(-5500);
    messages.push({
      role: 'assistant',
      content: tail,
    });
    messages.push({
      role: 'user',
      content:
        'Continue the exact HTML document from the exact last character above without repeating anything already written, and finish cleanly through </html>.',
    });
  }

  sendSse(res, 'status', {
    message:
      pass > 1
        ? `HTML kodi davom ettirilmoqda (${pass}-bosqich)...`
        : 'Qwen 3.8 Omni Flash izometrik HTML kodini 0 dan yozmoqda...',
    pass,
  });

  let lastErrMsg = 'Qwen API bilan bog‘lanib bo‘lmadi.';
  let primaryIntlErr = '';

  for (const baseUrl of baseUrls) {
    for (const modelName of modelsToTry) {
      const remainingMs = Math.max(8_000, maxRunMs - (Date.now() - startTime));
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), remainingMs);

      try {
        const lowerModel = modelName.toLowerCase();
        const isOmni = lowerModel.includes('omni');
        const supportsThinking = isOmni || lowerModel.includes('qwen3.5');
        const body: Record<string, unknown> = {
          model: modelName,
          messages,
          stream: true,
          stream_options: { include_usage: true },
          temperature: 0.25,
          max_tokens: 16384,
        };
        if (isOmni) {
          body.modalities = ['text'];
        }
        if (supportsThinking) {
          if (pass === 1 && !continueFrom.trim()) {
            body.enable_thinking = true;
            body.thinking_budget = 2048;
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
            break; // try next region endpoint
          }
          continue;
        }

        sendSse(res, 'status', {
          message: `${modelName} orqali jonli HTML generatsiya qilinmoqda...`,
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

        const combinedRaw = continueFrom + deltaAccum;
        const hasClosingHtml = /<\/html>/i.test(combinedRaw);
        const tokenUsage: TokenUsageInfo = finalUsage
          ? usageFromDashScope(finalUsage, actualModel)
          : usageFromDashScope(
              {
                // Fallback estimate ONLY if stream aborted before final usage packet
                prompt_tokens: Math.round(
                  messages.reduce((acc, m) => acc + m.content.length, 0) / 3.6
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

        if (deltaAccum.length > 120 && (timedOutSoft || finishedNormally)) {
          sendSse(res, 'partial', {
            htmlSoFar: combinedRaw.replace(/^```(?:html)?\s*/i, ''),
            model: actualModel,
            token_usage: tokenUsage,
            pass,
          });
          res.end();
          return;
        }
      } catch (err: unknown) {
        clearTimeout(abortTimer);
        lastErrMsg = err instanceof Error ? err.message : String(err);
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
