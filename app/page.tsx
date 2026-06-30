import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import AdminPanel from './AdminPanel';
import AutoRefresh from './AutoRefresh';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let leads: any[] = [];
  let approvals: any[] = [];
  let configError: string | null = null;
  let totalLeads = 0;
  let totalQuentes = 0;
  let totalFollowups = 0;

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const countAll = await supabaseAdmin.from('leads').select('id', { count: 'exact', head: true });
    totalLeads = countAll.count || 0;

    const countQuentes = await supabaseAdmin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .in('status', ['aprovou','duvida','pediu_alteracao']);
    totalQuentes = countQuentes.count || 0;

    const countFollowups = await supabaseAdmin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .in('status', ['nao_respondeu','vou_pensar','achou_caro','nao_quer_agora']);
    totalFollowups = countFollowups.count || 0;

    const result = await supabaseAdmin.from('leads').select('*').order('updated_at', { ascending: false }).limit(100);
    leads = result.data || [];
    if (result.error) configError = result.error.message;

    const pending = await supabaseAdmin
      .from('followup_approvals')
      .select('*')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50);
    approvals = pending.data || [];
    if (pending.error) configError = pending.error.message;
  } catch (error: any) {
    configError = error.message;
  }

  const pendingCount = approvals.length;

  return <main className="wrap">
    <header className="hero">
      <div>
        <span className="badge">Elevance Seguros</span>
        <h1>Central de Follow-up</h1>
        <p className="muted">Painel interno para revisar mensagens geradas pelo Claude e aprovar envios pelo WhatsApp.</p>
        <AutoRefresh />
      </div>
    </header>

    {configError && <section className="card" style={{marginBottom:24}}><strong>Atenção:</strong><p className="muted">{configError}</p></section>}

    <section className="grid">
      <div className="card"><span className="badge">Total de leads</span><h2>{totalLeads}</h2></div>
      <div className="card"><span className="badge">Precisam de ação</span><h2>{totalQuentes}</h2></div>
      <div className="card"><span className="badge">Em follow-up</span><h2>{totalFollowups}</h2></div>
      <div className="card"><span className="badge">Aguardando aprovação</span><h2>{pendingCount}</h2></div>
    </section>

    <AdminPanel approvals={approvals} />

    <section className="card" style={{marginTop:24}}>
      <h2>Últimos leads</h2>
      <p className="muted">Mostrando até 100 leads mais recentes. Total no CRM: {totalLeads}.</p>
      <div className="table-wrap">
        <table className="table"><thead><tr><th>Nome</th><th>Telefone</th><th>Produto</th><th>Status</th><th>Próximo follow-up</th><th>Resumo</th></tr></thead><tbody>{leads.map((lead:any)=><tr key={lead.id}><td>{lead.nome || '-'}</td><td>{lead.telefone}</td><td>{lead.produto}</td><td>{lead.status}</td><td>{lead.next_followup_at ? new Date(lead.next_followup_at).toLocaleString('pt-BR') : '-'}</td><td>{lead.resumo || '-'}</td></tr>)}</tbody></table>
      </div>
    </section>
  </main>;
}
