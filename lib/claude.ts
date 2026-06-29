type Classification = {
  intencao: string;
  produto: string;
  urgencia: 'baixa' | 'media' | 'alta';
  resumo: string;
  acao_recomendada: string;
  mensagem_sugerida?: string;
};

export async function classifyLead(input: Record<string, unknown>): Promise<Classification> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY ausente');

  const prompt = `Você é o assistente de follow-up da Elevance Seguros. Classifique o lead sem prometer cobertura, preço ou aprovação. Responda apenas JSON válido com: intencao, produto, urgencia, resumo, acao_recomendada, mensagem_sugerida. Dados: ${JSON.stringify(input)}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', max_tokens: 700, messages: [{ role: 'user', content: prompt }] })
  });

  if (!res.ok) throw new Error(`Erro Claude: ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || '{}';
  return JSON.parse(text);
}
