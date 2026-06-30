import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { classifyLead } from '@/lib/claude';

const Body = z.object({
  appSecret: z.string().optional().nullable(),
  dryRun: z.boolean().default(true),
  pattern: z.string().default('*_historico'),
  limit: z.number().int().min(1).max(1000).default(200),
  keys: z.array(z.string()).optional()
});

type ChatMessage = {
  role: 'user' | 'assistant' | string;
  content: string;
};

function isAuthorized(req: NextRequest, body?: any) {
  const receivedSecret = req.headers.get('x-elevance-secret')?.trim() || body?.appSecret?.trim();
  const acceptedSecrets = [process.env.APP_SECRET, process.env.N8N_WEBHOOK_SECRET].filter(Boolean);
  return acceptedSecrets.length === 0 || (!!receivedSecret && acceptedSecrets.includes(receivedSecret));
}

function upstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Variáveis UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN ausentes');
  return { url: url.replace(/\/$/, ''), token };
}

async function redisCommand(command: any[]) {
  const { url, token } = upstashConfig();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(command),
    cache: 'no-store'
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Erro Upstash ${res.status}: ${JSON.stringify(data)}`);
  if (data?.error) throw new Error(`Erro Upstash: ${data.error}`);
  return data?.result;
}

async function scanKeys(pattern: string, limit: number) {
  let cursor = '0';
  const keys: string[] = [];

  do {
    const result = await redisCommand(['SCAN', cursor, 'MATCH', pattern, 'COUNT', 100]);
    cursor = String(result?.[0] || '0');
    const batch = Array.isArray(result?.[1]) ? result[1] : [];
    for (const key of batch) {
      keys.push(String(key));
      if (keys.length >= limit) return keys;
    }
  } while (cursor !== '0');

  return keys;
}

function parseMessages(raw: any): ChatMessage[] {
  let value = raw;

  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return []; }
  }

  if (value && typeof value === 'object' && 'value' in value) {
    value = (value as any).value;
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch { return []; }
    }
  }

  if (!Array.isArray(value)) return [];

  return value
    .filter((item: any) => item && typeof item.content === 'string')
    .map((item: any) => ({ role: String(item.role || 'user'), content: item.content }));
}

function phoneFromKey(key: string) {
  return key.replace(/_historico$/, '').replace(/\D/g, '');
}

function detectProduct(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes('sagrada família') || lower.includes('sagrada familia')) return 'plano_saude';
  if (lower.includes('plano') || lower.includes('saúde') || lower.includes('saude') || lower.includes('hapvida') || lower.includes('unimed')) return 'plano_saude';
  if (lower.includes('seguro auto') || lower.includes('carro')) return 'seguro_auto';
  if (lower.includes('vida')) return 'seguro_vida';
  if (lower.includes('consórcio') || lower.includes('consorcio')) return 'consorcio';
  return 'outro';
}

function firstUserMessage(messages: ChatMessage[]) {
  return messages.find(m => m.role === 'user')?.content || messages[0]?.content || '';
}

function lastUserMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find(m => m.role === 'user')?.content || '';
}

function lastAssistantMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find(m => m.role === 'assistant')?.content || '';
}

function nextDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    if (!isAuthorized(req, rawBody)) return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 });

    const body = Body.parse(rawBody);
    const keys = body.keys?.length ? body.keys.slice(0, body.limit) : await scanKeys(body.pattern, body.limit);
    const supabaseAdmin = getSupabaseAdmin();

    const results = [];

    for (const key of keys) {
      const phone = phoneFromKey(key);
      if (!phone) {
        results.push({ key, ok: false, reason: 'telefone não identificado' });
        continue;
      }

      const raw = await redisCommand(['GET', key]);
      const messages = parseMessages(raw);
      if (!messages.length) {
        results.push({ key, telefone: phone, ok: false, reason: 'histórico vazio ou formato não suportado' });
        continue;
      }

      const conversationText = messages.map(m => `${m.role}: ${m.content}`).join('\n');
      const produto = detectProduct(conversationText);
      let classification: any = null;

      try {
        classification = await classifyLead({
          tarefa: 'classificar histórico antigo de WhatsApp para importação no CRM da Elevance. Gere resumo curto, status provável e próxima ação sem criar promessa de cobertura/preço/aprovação.',
          historico: messages,
          telefone: phone,
          produto_detectado: produto
        });
      } catch (e: any) {
        classification = {
          intencao: 'nao_respondeu',
          produto,
          urgencia: 'media',
          resumo: firstUserMessage(messages).slice(0, 240),
          acao_recomendada: 'Fazer follow-up manual para retomar o atendimento.'
        };
      }

      const status = classification?.intencao || 'nao_respondeu';
      const resumo = classification?.resumo || firstUserMessage(messages).slice(0, 240);
      const lead = {
        telefone: phone,
        nome: null,
        produto: classification?.produto || produto,
        status,
        origem: 'upstash_import_30d',
        ultima_mensagem_cliente: lastUserMessage(messages),
        ultima_mensagem_enviada: lastAssistantMessage(messages),
        resumo,
        urgencia: classification?.urgencia || 'media',
        next_followup_at: nextDate(1),
        updated_at: new Date().toISOString()
      };

      if (!body.dryRun) {
        const { data: savedLead, error: leadError } = await supabaseAdmin
          .from('leads')
          .upsert(lead, { onConflict: 'telefone' })
          .select('id')
          .single();

        if (leadError) throw leadError;

        await supabaseAdmin.from('lead_events').insert({
          lead_id: savedLead.id,
          type: 'redis_history_imported',
          payload: { key, messages, classification, imported_at: new Date().toISOString() }
        });
      }

      results.push({
        key,
        telefone: phone,
        ok: true,
        dryRun: body.dryRun,
        mensagens: messages.length,
        produto: lead.produto,
        status: lead.status,
        resumo: lead.resumo,
        ultima_mensagem_cliente: lead.ultima_mensagem_cliente
      });
    }

    return NextResponse.json({ ok: true, dryRun: body.dryRun, pattern: body.pattern, totalKeys: keys.length, imported: body.dryRun ? 0 : results.filter(r => r.ok).length, results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
