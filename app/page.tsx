import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import AdminPanel from './AdminPanel';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let leads: any[] = [];
  let configError: string | null = null;
  let pendingCount = 0;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const result = await supabaseAdmin.from('leads').select('*').order('updated_at', { ascending: false }).limit(20);
    leads = result.data || [];
    if (result.error) configError = result.error.message;

    const pending = await supabaseAdmin
      .from('followup_approvals')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending');
    pendingCount = pending.count || 0;
  } catch (error: any) {
    configError = error.message;
  }

  const total = leads.length;
  const quentes = leads.filter(l => ['aprovou','duvida','pediu_alteracao'].includes(l.status)).length;
  const followups = leads.filter(l => ['nao_respondeu','vou_pensar','achou_caro','nao_quer_agora'].includes(l.status)).length;

  return <main className="wrap">
    <header className="hero">
      <div>
        <span className="badge">Elevance Seguros</span>
        <h1>Central de Follow-up</h1>
        <p className="muted">Painel interno para revisar mensagens geradas pelo Claude e aprovar envios pelo WhatsApp.</p>
      </div>
    </header>

    {configError && <section className="card" style={{marginBottom:24}}><strong>Atenção:</strong><p className="muted">{configError}</p></section>}

    <section className="grid">
      <div className="card"><span className="badge">Leads recentes</span><h2>{total}</h2></div>
      <div className="card"><span className="badge">Precisam de ação</span><h2>{quentes}</h2></div>
      <div className="card"><span className="badge">Em follow-up</span><h2>{followups}</h2></div>
      <div className="card"><span className="badge">Aguardando aprovação</span><h2>{pendingCount}</h2></div>
    </section>

    <AdminPanel />

    <section className="card" style={{marginTop:24}}>
      <h2>Últimos leads</h2>
      <div className="table-wrap">
        <table className="table"><thead><tr><th>Nome</th><th>Telefone</th><th>Produto</th><th>Status</th><th>Próximo follow-up</th><th>Resumo</th></tr></thead><tbody>{leads.map((lead:any)=><tr key={lead.id}><td>{lead.nome || '-'}</td><td>{lead.telefone}</td><td>{lead.produto}</td><td>{lead.status}</td><td>{lead.next_followup_at ? new Date(lead.next_followup_at).toLocaleString('pt-BR') : '-'}</td><td>{lead.resumo || '-'}</td></tr>)}</tbody></table>
      </div>
    </section>
  </main>;
}
