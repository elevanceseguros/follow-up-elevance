import { NextRequest } from 'next/server';

export function assertSecret(req: NextRequest) {
  const expected = process.env.N8N_WEBHOOK_SECRET || process.env.APP_SECRET;
  if (!expected) return;
  const received = req.headers.get('x-elevance-secret');
  if (received !== expected) throw new Error('Webhook não autorizado');
}
