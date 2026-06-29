import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendWhatsApp } from '@/lib/zapi';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { assertSecret } from '@/lib/security';
const Body=z.object({leadId:z.string().optional(), telefone:z.string().min(8), mensagem:z.string().min(2)});
export async function POST(req: NextRequest){try{assertSecret(req);const body=Body.parse(await req.json());const zapi=await sendWhatsApp(body.telefone,body.mensagem);if(body.leadId){const supabaseAdmin=getSupabaseAdmin();await supabaseAdmin.from('lead_events').insert({lead_id:body.leadId,type:'sent_message',payload:{mensagem:body.mensagem,zapi}});await supabaseAdmin.from('leads').update({ultima_mensagem_enviada:body.mensagem,updated_at:new Date().toISOString()}).eq('id',body.leadId)}return NextResponse.json({ok:true,zapi})}catch(e:any){return NextResponse.json({ok:false,error:e.message},{status:400})}}
