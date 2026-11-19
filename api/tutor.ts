import type { IncomingMessage, ServerResponse } from 'node:http';
import tutorResolveHandler from './tutor/resolve.ts';
import { getModalProxyConfig, sendJson } from './lib/modalProxy.ts';

export const config = { maxDuration: 60, api: { bodyParser: { sizeLimit: '5mb' } } };

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  if (!getModalProxyConfig()) {
    sendJson(res, 503, { error: 'Tutor service is not configured.' });
    return;
  }

  const originalUrl = req.url;
  req.url = '/api/tutor/resolve';
  void Promise.resolve(tutorResolveHandler(req, res))
    .catch(() => {
      if (!res.headersSent) sendJson(res, 502, { error: 'Tutor service is temporarily unavailable.' });
      else if (!res.writableEnded) res.end();
    })
    .finally(() => {
      req.url = originalUrl;
    });
}
