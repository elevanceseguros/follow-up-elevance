import { NextRequest } from 'next/server';

export function assertSecret(req: NextRequest) {
  const acceptedSecrets = [
    process.env.APP_SECRET,
    process.env.N8N_WEBHOOK_SECRET,
  ].filter(Boolean);

  if (acceptedSecrets.length === 0) return;

  const received = req.headers.get('x-elevance-secret')?.trim();
  if (!received || !acceptedSecrets.includes(received)) {
    throw new Error('Webhook não autorizado');
  }
}
