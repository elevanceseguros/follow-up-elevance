type Classification = {
  intencao: string;
  produto: string;
  urgencia: 'baixa' | 'media' | 'alta';
  resumo: string;
  acao_recomendada: string;
  mensagem_sugerida?: string;
};

function fallbackClassify(input: Record<string, unknown>): Classification {
  const rawText = [input.status, input.ultimaMensagemCliente, input.transcricaoAudio, input.ultimaMensagemEnviada].filter(Boolean).join(' ').toLowerCase();
  let intencao = 'nao_respondeu';
  let urgencia: 'baixa' | 'media' | 'alta' = 'media';

  if (rawText.includes('fechar') || rawText.includes('aprov') || rawText.includes('pode fazer') || rawText.includes('vamos fechar')) { intencao = 'aprovou'; urgencia = 'alta'; }
  else if (rawText.includes('caro') || rawText.includes('valor') || rawText.includes('preço') || rawText.includes('preco')) intencao = 'achou_caro';
  else if (rawText.includes('pensar') || rawText.includes('vejo') || rawText.includes('depois')) intencao = 'vou_pensar';
  else if (rawText.includes('dúvida') || rawText.includes('duvida') || rawText.includes('?')) intencao = 'duvida';
  else if (rawText.includes('não quero') || rawText.includes('nao quero') || rawText.includes('não tenho interesse') || rawText.includes('nao tenho interesse')) { intencao = 'nao_quer_agora'; urgencia = 'baixa'; }

  const produto = String(input.produto || 'outro');
  return {
    intencao,
    produto,
    urgencia,
    resumo: 'Classificação automática local usada porque o Claude não respondeu com sucesso.',
    acao_recomendada: intencao === 'aprovou' ? 'Priorizar atendimento humano para fechamento.' : 'Manter na régua de follow-up.',
    mensagem_sugerida: 'Oi! Passando rapidinho para saber se ficou alguma dúvida sobre a proposta que te enviei.'
  };
}

function parseClaudeJson(text: string): Classification {
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first >= 0 && last > first) {
      return JSON.parse(cleaned.slice(first, last + 1));
    }
    throw new Error('Claude não retornou JSON válido');
  }
}

export async function classifyLead(input: Record<string, unknown>): Promise<Classification> {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPICAPIKEY;
  if (!apiKey) return fallbackClassify(input);

  const prompt = `Retorne SOMENTE um objeto JSON válido, sem markdown, sem texto antes e sem texto depois.

Você é o assistente de follow-up da Elevance Seguros. Classifique o lead sem prometer cobertura, preço ou aprovação.

Campos obrigatórios:
{
  "intencao": "aprovou | achou_caro | vou_pensar | duvida | pediu_alteracao | nao_quer_agora | nao_respondeu",
  "produto": "plano_saude | seguro_auto | seguro_moto | seguro_vida | consorcio | protecao_veicular | outro",
  "urgencia": "baixa | media | alta",
  "resumo": "resumo curto do caso",
  "acao_recomendada": "próxima ação recomendada",
  "mensagem_sugerida": "mensagem curta e natural de WhatsApp"
}

Dados do lead: ${JSON.stringify(input)}`;

  const modelCandidates = Array.from(new Set([
    'claude-haiku-4-5-20251001',
    process.env.ANTHROPIC_MODEL,
    process.env.CLAUDE_MODEL,
    'claude-sonnet-4-5-20250929'
  ].filter(Boolean))) as string[];

  for (const model of modelCandidates) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 700, temperature: 0, messages: [{ role: 'user', content: prompt }] })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text || '{}';
        const parsed = parseClaudeJson(text);
        return {
          intencao: parsed.intencao || 'nao_respondeu',
          produto: parsed.produto || String(input.produto || 'outro'),
          urgencia: parsed.urgencia || 'media',
          resumo: parsed.resumo || 'Lead classificado pelo Claude.',
          acao_recomendada: parsed.acao_recomendada || 'Manter na régua de follow-up.',
          mensagem_sugerida: parsed.mensagem_sugerida || 'Oi! Passando rapidinho para saber se ficou alguma dúvida sobre a proposta que te enviei.'
        };
      }
    } catch {
      // tenta próximo modelo ou fallback abaixo
    }
  }

  return fallbackClassify(input);
}
