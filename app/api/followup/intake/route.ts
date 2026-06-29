import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { classifyLead } from '@/lib/claude';
import { assertSecret } from '@/lib/security';

const Body = z.object({ nome:z.string().optional().nullable(), telefone:z.string().min(8), produto:z.string().default('outro'), status:z.string().default('novo'), ultimaMensagemCliente:z.string().optional().nullable(), ultimaMensagemEnviada:z.string().optional().nullable(), transcricaoAudio:z.string().optional().nullable(), origem:z.string().default('n8n') });

export async function POST(req: NextRequest) {
  try {
    assertSecret(req);
    const supabaseAdmin = getSupabaseAdmin();
    const body = Body.parse(await req.json());
    const classification = await classifyLead(body);
    const status = normalizeStatus(classification.intencao || body.status);
    const { data, error } = await supabaseAdmin.from('leads').upsert({ telefone: body.telefone, nome: body.nome, produto: normalizeProduct(classification.produto || body.produto), status, origem: body.origem, ultima_mensagem_cliente: body.transcricaoAudio || body.ultimaMensagemCliente, ultima_mensagem_enviada: body.ultimaMensagemEnviada, resumo: classification.resumo, urgencia: classification.urgencia || 'media', next_followup_at: nextFollowup(status), updated_at: new Date().toISOString() }, { onConflict: 'telefone' }).select().single();
    if (error) throw error;
    await supabaseAdmin.from('lead_events').insert({ lead_id: data.id, type: 'intake', payload: { body, classification } });
    return NextResponse.json({ ok:true, lead:data, classification });
  } catch (e:any) { return NextResponse.json({ ok:false, error:e.message }, { status:400 }); }
}
function normalizeStatus(v:string){const s=v.toLowerCase(); if(s.includes('aprov'))return'aprovou'; if(s.includes('caro'))return'achou_caro'; if(s.includes('pens'))return'vou_pensar'; if(s.includes('duv'))return'duvida'; if(s.includes('alter'))return'pediu_alteracao'; if(s.includes('não')||s.includes('nao'))return'nao_quer_agora'; return'nao_respondeu'}
function normalizeProduct(v:string){const s=v.toLowerCase(); if(s.includes('saude')||s.includes('saúde'))return'plano_saude'; if(s.includes('auto')||s.includes('carro'))return'seguro_auto'; if(s.includes('moto'))return'seguro_moto'; if(s.includes('vida'))return'seguro_vida'; if(s.includes('consor'))return'consorcio'; if(s.includes('prote'))return'protecao_veicular'; return'outro'}
function nextFollowup(status:string){ if(['aprovou','duvida','pediu_alteracao'].includes(status)) return null; const d=new Date(); d.setDate(d.getDate()+1); return d.toISOString(); }
