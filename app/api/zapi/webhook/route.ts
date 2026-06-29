import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest){
  const payload=await req.json();
  const phone=payload.phone || payload.senderPhone || payload.from || payload.sender;
  const text=payload.text?.message || payload.message || payload.body || payload.audioTranscription || null;
  if(!phone) return NextResponse.json({ok:false,error:'phone ausente'},{status:400});
  const { data: lead } = await supabaseAdmin.from('leads').select('*').eq('telefone', phone).maybeSingle();
  if(lead){ await supabaseAdmin.from('lead_events').insert({lead_id:lead.id,type:'incoming_message',payload}); await supabaseAdmin.from('leads').update({ultima_mensagem_cliente:text,status:'duvida',next_followup_at:null,updated_at:new Date().toISOString()}).eq('id',lead.id); }
  return NextResponse.json({ok:true,paused:!!lead});
}
