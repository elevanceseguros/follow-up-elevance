import { NextRequest, NextResponse } from 'next/server';
import { classifyLead } from '@/lib/claude';
import { assertSecret } from '@/lib/security';

export async function POST(req: NextRequest) {
  try { assertSecret(req); const body = await req.json(); const result = await classifyLead({ ...body, tarefa: 'gerar mensagem curta de follow-up para WhatsApp, tom humano e vendedor, sem parecer robô' }); return NextResponse.json({ ok:true, ...result }); }
  catch(e:any){ return NextResponse.json({ ok:false, error:e.message }, { status:400 }); }
}
