(() => {
  const DEFAULT_PLATFORM_URL = 'http://localhost:3000';
  const BUTTON_ID = 'uz3d-ai-launch-btn';

  function getVideoId() {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get('v') || '';
    } catch {
      return '';
    }
  }

  function formatSec(secFloat) {
    const total = Math.max(0, Math.floor(secFloat));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function getVideoTitle() {
    const h1 =
      document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
      document.querySelector('h1.title yt-formatted-string');
    return (h1?.textContent || document.title.replace(/\s*-\s*YouTube$/, '')).trim();
  }

  function readDomTranscript() {
    const rows = document.querySelectorAll('ytd-transcript-segment-renderer');
    if (!rows.length) return '';
    const lines = [];
    rows.forEach((row) => {
      const ts = row.querySelector('.segment-timestamp')?.textContent?.trim() || '00:00';
      const txt = row.querySelector('.segment-text')?.textContent?.trim() || '';
      if (txt) lines.push(`[${ts}] ${txt}`);
    });
    return lines.join('\n');
  }

  async function readPlayerCaptions(videoId) {
    // 1. Try open DOM transcript first
    const domText = readDomTranscript();
    if (domText.length > 40) return domText;

    // 2. Read captionTracks embedded in the watch page HTML inside the user's browser
    try {
      const htmlRes = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
        credentials: 'include',
      });
      const html = await htmlRes.text();
      const match = html.match(/"captionTracks"\s*:\s*(\[[\s\S]*?\])\s*,\s*"audioTracks"/);
      if (!match) return '';
      const tracks = JSON.parse(match[1]);
      if (!Array.isArray(tracks) || tracks.length === 0) return '';

      const preferred =
        tracks.find((t) => t.languageCode === 'uz') ||
        tracks.find((t) => t.languageCode === 'en') ||
        tracks[0];
      if (!preferred?.baseUrl) return '';

      const capUrl = `${preferred.baseUrl}&fmt=json3`;
      const capRes = await fetch(capUrl, { credentials: 'include' });
      const json3 = await capRes.json();
      const events = Array.isArray(json3?.events) ? json3.events : [];
      const lines = [];
      for (const ev of events) {
        if (!Array.isArray(ev.segs)) continue;
        const text = ev.segs
          .map((s) => s.utf8 || '')
          .join('')
          .replace(/\s+/g, ' ')
          .trim();
        if (!text) continue;
        const startSec = (Number(ev.tStartMs) || 0) / 1000;
        lines.push(`[${formatSec(startSec)}] ${text}`);
      }
      return lines.join('\n');
    } catch {
      return '';
    }
  }

  async function getPlatformUrl() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get(['uz3dPlatformUrl'], (res) => {
          const val = String(res?.uz3dPlatformUrl || DEFAULT_PLATFORM_URL).replace(/\/+$/, '');
          resolve(val || DEFAULT_PLATFORM_URL);
        });
      } catch {
        resolve(DEFAULT_PLATFORM_URL);
      }
    });
  }

  async function extractAndSendLesson(buttonEl) {
    const videoId = getVideoId();
    if (!videoId) {
      throw new Error('YouTube video identifikatori topilmadi.');
    }

    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = 'Subtitr o‘qilmoqda...';
    }

    try {
      const title = getVideoTitle();
      let subtitles = await readPlayerCaptions(videoId);
      if (!subtitles) {
        subtitles = `[00:00] ${title}`;
      }

      const platformUrl = await getPlatformUrl();
      if (buttonEl) {
        buttonEl.textContent = 'Uz3D dars tuzilmoqda...';
      }

      const resp = await fetch(`${platformUrl}/api/generate-lesson`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'youtube_subtitles',
          video_id: videoId,
          topic: title,
          subtitles: subtitles.slice(0, 14000),
        }),
      });

      if (!resp.ok) {
        throw new Error(`Server javobi: ${resp.status}`);
      }

      const data = await resp.json();
      const targetUrl = `${platformUrl}/?uz3d_video_id=${encodeURIComponent(videoId)}`;
      window.open(targetUrl, '_blank', 'noopener');
      return { ok: true, videoId, title: data.lesson_title_uz || title, targetUrl };
    } finally {
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.textContent = 'Uz3D Doskada O‘rganish';
      }
    }
  }

  function injectYouTubeButton() {
    if (!window.location.pathname.startsWith('/watch')) return;
    if (document.getElementById(BUTTON_ID)) return;

    const host =
      document.querySelector('#top-level-buttons-computed') ||
      document.querySelector('#actions-inner #top-row') ||
      document.querySelector('#above-the-fold #actions');
    if (!host) return;

    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';
    btn.textContent = 'Uz3D Doskada O‘rganish';
    btn.style.cssText = [
      'margin-left: 8px',
      'height: 36px',
      'padding: 0 14px',
      'border-radius: 18px',
      'border: 1px solid #1D4ED8',
      'background: #2563EB',
      'color: #FFFFFF',
      'font-family: system-ui, -apple-system, sans-serif',
      'font-size: 13px',
      'font-weight: 600',
      'cursor: pointer',
      'white-space: nowrap',
    ].join(';');

    btn.addEventListener('click', () => {
      extractAndSendLesson(btn).catch((err) => {
        btn.textContent = err?.message ? `Xato: ${err.message.slice(0, 28)}` : 'Xatolik yuz berdi';
        setTimeout(() => {
          btn.textContent = 'Uz3D Doskada O‘rganish';
        }, 3000);
      });
    });

    host.appendChild(btn);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action === 'EXTRACT_AND_SEND') {
      const btn = document.getElementById(BUTTON_ID);
      extractAndSendLesson(btn)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ ok: false, error: err?.message || 'Xatolik' }));
      return true;
    }
    return false;
  });

  const observer = new MutationObserver(() => injectYouTubeButton());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('yt-navigate-finish', () => setTimeout(injectYouTubeButton, 500));
  setTimeout(injectYouTubeButton, 800);
})();
