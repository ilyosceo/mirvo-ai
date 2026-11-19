export interface QwenLessonRequest {
  query: string;
  userPrompt: string;
  systemInstruction: string;
  depthMode: 'overview' | 'standard' | 'deep';
  imageBase64?: string;
  imageMimeType?: string;
}

export interface QwenLessonResult {
  text: string;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  cacheHit: boolean;
}

const MAX_IMAGE_BASE64_CHARS = 4_200_000;
const MAX_RESPONSE_BYTES = 500_000;
const MODAL_ENDPOINT_PATTERN =
  /^https:\/\/[a-z0-9][a-z0-9-]*--mirvo-qwen-gateway-web\.modal\.run\/v1\/lesson\/generate$/i;

function isLesson(value: unknown): value is {
  topic_title: string;
  subject: string;
  engine: string;
  sliders: unknown[];
  steps: unknown[];
} {
  if (!value || typeof value !== 'object') return false;
  const lesson = value as Record<string, unknown>;
  return (
    typeof lesson.topic_title === 'string' &&
    typeof lesson.subject === 'string' &&
    typeof lesson.engine === 'string' &&
    Array.isArray(lesson.sliders) &&
    lesson.sliders.length <= 20 &&
    Array.isArray(lesson.steps) &&
    lesson.steps.length > 0 &&
    lesson.steps.length <= 16 &&
    lesson.steps.every((step) => Boolean(step) && typeof step === 'object')
  );
}

async function readBoundedResponse(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new Error('Qwen service returned an oversized response.');
  }
  if (!response.body) {
    throw new Error('Qwen service returned an empty response.');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('Qwen service returned an oversized response.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function generateLessonWithQwen(
  input: QwenLessonRequest
): Promise<QwenLessonResult> {
  const endpoint = process.env.MODAL_QWEN_URL;
  const sharedSecret = process.env.MODAL_GATEWAY_SECRET;
  if (
    !endpoint ||
    !MODAL_ENDPOINT_PATTERN.test(endpoint) ||
    !sharedSecret ||
    sharedSecret.length < 32
  ) {
    throw new Error('Qwen gateway is not configured.');
  }
  if (
    input.query.length > 4000 ||
    input.userPrompt.length > 12000 ||
    input.systemInstruction.length > 40000 ||
    (input.imageBase64?.length ?? 0) > MAX_IMAGE_BASE64_CHARS
  ) {
    throw new Error('Lesson request exceeds size limits.');
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sharedSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: input.query,
        user_prompt: input.userPrompt,
        system_instruction: input.systemInstruction,
        depth_mode: input.depthMode,
        image_base64: input.imageBase64,
        image_mime_type: input.imageMimeType,
      }),
      signal: AbortSignal.timeout(58_000),
    });
  } catch {
    throw new Error('Qwen service is temporarily unavailable.');
  }

  if (!response.ok) {
    if (response.status === 429 || response.status === 503) {
      throw new Error('AI requests are temporarily busy. Please try again shortly.');
    }
    if (response.status === 504) {
      throw new Error('AI request timed out. Please try again.');
    }
    throw new Error('Qwen service could not generate a lesson.');
  }

  const raw = await readBoundedResponse(response);

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('Qwen service returned an invalid response.');
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('Qwen service returned an invalid response.');
  }
  const result = payload as Record<string, unknown>;
  if (typeof result.text !== 'string' || result.text.length > 100_000) {
    throw new Error('Qwen service returned an invalid lesson.');
  }

  let lesson: unknown;
  try {
    lesson = JSON.parse(result.text);
  } catch {
    throw new Error('Qwen service returned an invalid lesson.');
  }
  if (!isLesson(lesson)) {
    throw new Error('Qwen service returned an invalid lesson.');
  }

  const rawUsage =
    result.usage && typeof result.usage === 'object'
      ? (result.usage as Record<string, unknown>)
      : null;
  const count = (value: unknown) =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
  return {
    text: result.text,
    usageMetadata: rawUsage
      ? {
          promptTokenCount: count(rawUsage.prompt_tokens),
          candidatesTokenCount: count(rawUsage.completion_tokens),
          totalTokenCount: count(rawUsage.total_tokens),
        }
      : undefined,
    cacheHit: result.cache_hit === true,
  };
}
