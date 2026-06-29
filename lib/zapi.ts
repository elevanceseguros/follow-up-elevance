export async function sendWhatsApp(phone: string, message: string) {
  const instance = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  if (!instance || !token || !clientToken) throw new Error('Variáveis da Z-API ausentes');

  const res = await fetch(`https://api.z-api.io/instances/${instance}/token/${token}/send-text`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'client-token': clientToken },
    body: JSON.stringify({ phone, message })
  });
  if (!res.ok) throw new Error(`Erro Z-API: ${res.status}`);
  return res.json();
}
