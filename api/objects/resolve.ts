import type { IncomingMessage, ServerResponse } from 'node:http';
import app from '../tutor/resolve.js';

export const maxDuration = 60;
export const config = {
  maxDuration: 60,
};

export default function handler(req: IncomingMessage, res: ServerResponse) {
  req.url = '/api/objects/resolve';
  return app(req, res);
}
