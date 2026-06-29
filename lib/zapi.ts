export async function sendWhatsApp(phone: string, message: string) {
  const instance = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  if (!instance || !token || !clientToken) throw new Error('Variáveis da Z-API ausentes');

  const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'client-token': clientToken },
    body: JSON.stringify({ phone, message })
  });

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (!res.ok) {
    throw new Error(`Erro Z-API: ${res.status} - ${JSON.stringify(data)}`);
  }

  return data;
}
