export interface YouTubeContextResult {
  videoId: string;
  title?: string;
  author?: string;
  transcript: string;
  thumbnailDataUrls: string[];
}

export function extractYouTubeVideoId(raw: string): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

async function fetchOEmbed(videoId: string): Promise<{ title?: string; author?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_500);
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
      { signal: controller.signal }
    );
    if (!res.ok) return {};
    const data = (await res.json()) as { title?: string; author_name?: string };
    return { title: data.title, author: data.author_name };
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPublicThumbnails(videoId: string): Promise<string[]> {
  const slots = ['hqdefault.jpg', '1.jpg', '2.jpg', '3.jpg'];
  const results = await Promise.all(
    slots.map(async (slot) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4_000);
      try {
        const res = await fetch(
          `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/${slot}`,
          { signal: controller.signal }
        );
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        // Skip tiny placeholder thumbnails (< 1.8 KB)
        if (buf.byteLength < 1800) return null;
        return `data:image/jpeg;base64,${buf.toString('base64')}`;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    })
  );
  return results.filter((x): x is string => Boolean(x));
}

export async function fetchYouTubeContext(
  youtubeUrlOrId: string
): Promise<YouTubeContextResult | null> {
  const videoId = extractYouTubeVideoId(youtubeUrlOrId);
  if (!videoId) return null;

  const [meta, thumbnailDataUrls] = await Promise.all([
    fetchOEmbed(videoId),
    fetchPublicThumbnails(videoId),
  ]);

  return {
    videoId,
    title: meta.title,
    author: meta.author,
    transcript: '',
    thumbnailDataUrls,
  };
}
