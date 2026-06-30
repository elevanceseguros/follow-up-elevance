type Classification = {
  intencao: string;
  produto: string;
  urgencia: 'baixa' | 'media' | 'alta';
  resumo: string;
  acao_recomendada: string;
  mensagem_sugerida?: string;
};

function fallbackClassify(input: Record<string, unknown>): Classification {
  const rawText = [input.status, input.ultimaMensagemCliente, input.transcricaoAudio, input.ultimaMensagemEnviada, input.resumo].filter(Boolean).join(' ').toLowerCase();
  let intencao = 'nao_respondeu';
  let urgencia: 'baixa' | 'media' | 'alta' = 'media';

  if (rawText.includes('fechei em outro') || rawText.includes('contratei em outro')) { intencao = 'perdido_fechou_outro_lugar'; urgencia = 'baixa'; }
  else if (rawText.includes('fechado') || rawText.includes('aprov') || rawText.includes('pode fazer') || rawText.includes('vamos fechar') || rawText.includes('contratado')) { intencao = 'cliente_ativo'; urgencia = 'alta'; }
  else if (rawText.includes('não quero') || rawText.includes('nao quero') || rawText.includes('não tenho interesse') || rawText.includes('nao tenho interesse')) { intencao = 'nao_tem_interesse'; urgencia = 'baixa'; }
  else if (rawText.includes('caro') || rawText.includes('valor') || rawText.includes('preço') || rawText.includes('preco')) intencao = 'achou_caro';
  else if (rawText.includes('pensar') || rawText.includes('vejo') || rawText.includes('depois')) intencao = 'vou_pensar';
  else if (rawText.includes('dúvida') || rawText.includes('duvida') || rawText.includes('?')) intencao = 'duvida';

  const produto = String(input.produto || 'outro');
  return {
    intencao,
    produto,
    urgencia,
    resumo: 'Classificação automática local usada porque o Claude não respondeu com sucesso.',
    acao_recomendada: ['cliente_ativo','perdido_fechou_outro_lugar','nao_tem_interesse'].includes(intencao) ? 'Não enviar follow-up de venda. Finalizar, pós-venda ou registrar perda.' : 'Manter na régua de follow-up.',
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

Você é o assistente de follow-up da Elevance Seguros. Analise com cuidado o contexto inteiro disponível. Não insista quando o cliente já fechou, já contratou em outro lugar ou disse que não quer. Não prometa cobertura, preço ou aprovação.

Campos obrigatórios:
{
  "intencao": "cliente_ativo | perdido_fechou_outro_lugar | nao_tem_interesse | aprovou | achou_caro | vou_pensar | duvida | pediu_alteracao | nao_quer_agora | nao_respondeu | renovacao_futura | pos_venda",
  "produto": "plano_saude | seguro_auto | seguro_moto | seguro_vida | consorcio | protecao_veicular | outro",
  "urgencia": "baixa | media | alta",
  "resumo": "resumo curto do caso, incluindo se já fechou, recusou ou contratou em outro lugar",
  "acao_recomendada": "próxima ação recomendada",
  "mensagem_sugerida": "mensagem curta e natural de WhatsApp; se não for para enviar follow-up de venda, deixe claro que deve finalizar ou pós-venda"
}

Regras:
- Se o cliente disse que fechou com a Elevance, use cliente_ativo e recomende pós-venda.
- Se o cliente disse que fechou em outro lugar, use perdido_fechou_outro_lugar e não recomende insistência.
- Se o cliente disse que não quer/não tem interesse, use nao_tem_interesse.
- Se for apólice de seguro auto com vencimento futuro, use renovacao_futura.

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
        body: JSON.stringify({ model, max_tokens: 900, temperature: 0, messages: [{ role: 'user', content: prompt }] })
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
