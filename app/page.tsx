import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { data: leads } = await supabaseAdmin.from('leads').select('*').order('updated_at', { ascending: false }).limit(20);
  const total = leads?.length || 0;
  const quentes = leads?.filter(l => ['aprovou','duvida','pediu_alteracao'].includes(l.status)).length || 0;
  const followups = leads?.filter(l => ['nao_respondeu','vou_pensar','achou_caro','nao_quer_agora'].includes(l.status)).length || 0;
  return <main className="wrap">
    <h1>Central de Follow-up Elevance</h1><p className="muted">MVP interno para recuperar leads parados do WhatsApp, classificar respostas e sugerir próximos passos.</p>
    <section className="grid"><div className="card"><span className="badge">Leads recentes</span><h2>{total}</h2></div><div className="card"><span className="badge">Precisam de ação</span><h2>{quentes}</h2></div><div className="card"><span className="badge">Em follow-up</span><h2>{followups}</h2></div></section>
    <section className="card" style={{marginTop:24}}><h2>Últimos leads</h2><table className="table"><thead><tr><th>Nome</th><th>Telefone</th><th>Produto</th><th>Status</th><th>Resumo</th></tr></thead><tbody>{leads?.map((lead:any)=><tr key={lead.id}><td>{lead.nome || '-'}</td><td>{lead.telefone}</td><td>{lead.produto}</td><td>{lead.status}</td><td>{lead.resumo || '-'}</td></tr>)}</tbody></table></section>
  </main>;
}
