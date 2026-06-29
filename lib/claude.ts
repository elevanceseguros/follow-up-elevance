type Classification = {
  intencao: string;
  produto: string;
  urgencia: 'baixa' | 'media' | 'alta';
  resumo: string;
  acao_recomendada: string;
  mensagem_sugerida?: string;
};

export async function classifyLead(input: Record<string, unknown>): Promise<Classification> {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPICAPIKEY;
  if (!apiKey) throw new Error('Chave Anthropic ausente. Configure ANTHROPIC_API_KEY ou ANTHROPICAPIKEY.');

  const prompt = `Você é o assistente de follow-up da Elevance Seguros. Classifique o lead sem prometer cobertura, preço ou aprovação. Responda apenas JSON válido com: intencao, produto, urgencia, resumo, acao_recomendada, mensagem_sugerida. Dados: ${JSON.stringify(input)}`;

  const modelCandidates = [
    process.env.ANTHROPIC_MODEL,
    process.env.CLAUDE_MODEL,
    'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest'
  ].filter(Boolean) as string[];

  let lastError = '';
  for (const model of modelCandidates) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 700, messages: [{ role: 'user', content: prompt }] })
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.content?.[0]?.text || '{}';
      return JSON.parse(text);
    }

    lastError = `Erro Claude: ${res.status} usando modelo ${model}`;
    if (![400, 404].includes(res.status)) break;
  }

  throw new Error(lastError || 'Erro Claude desconhecido');
}
