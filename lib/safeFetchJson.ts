export class NonJsonResponseError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'NonJsonResponseError';
    this.status = status;
  }
}

export async function safeParseJson<T>(
  res: Response,
  fallbackMessage = "Serverdan noto‘g‘ri javob keldi. Qayta urinib ko‘ring."
): Promise<T> {
  const rawText = await res.text();
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new NonJsonResponseError(
      !res.ok ? `Server xatosi (${res.status}). Qayta urinib ko‘ring.` : fallbackMessage,
      res.status
    );
  }

  if (/^</.test(trimmed)) {
    throw new NonJsonResponseError(
      "Server kutilgan ma’lumot o‘rniga HTML sahifa qaytardi. Qayta urinib ko‘ring.",
      res.status
    );
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new NonJsonResponseError(fallbackMessage, res.status);
  }
}

export async function safeParseJsonOrNull<T>(res: Response): Promise<T | null> {
  try {
    const rawText = await res.text();
    const trimmed = rawText.trim();
    if (!trimmed || /^</.test(trimmed)) {
      return null;
    }
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}
