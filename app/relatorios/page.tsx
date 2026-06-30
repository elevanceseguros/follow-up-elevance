import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function groupedCount(items: any[], key: string) {
  const out: Record<string, number> = {};
  for (const item of items) {
    const label = item[key] || 'sem_info';
    out[label] = (out[label] || 0) + 1;
  }
  return out;
}

export default async function RelatoriosPage() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from('leads')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(500);

  const leads = data || [];
  const status = groupedCount(leads, 'status');
  const produtos = groupedCount(leads, 'produto');
  const abertos = leads.filter((lead:any) => ['nao_respondeu','vou_pensar','achou_caro','nao_quer_agora'].includes(lead.status));
  const ativos = leads.filter((lead:any) => lead.status === 'cliente_ativo');
  const renovacoes = leads.filter((lead:any) => lead.renewal_date || lead.status === 'renovacao_futura');

  return <main className="wrap">
    <header className="hero">
      <div>
        <span className="badge">Elevance Seguros</span>
        <h1>Relatórios</h1>
        <p className="muted">Resumo online dos leads, clientes, finalizações e renovações.</p>
      </div>
      <div className="report-actions no-print">
        <a className="btn secondary" href="/">Voltar</a>
        <PrintButton />
      </div>
    </header>

    <section className="grid">
      <div className="card"><span className="badge">Total no relatório</span><h2>{leads.length}</h2></div>
      <div className="card"><span className="badge">Leads em aberto</span><h2>{abertos.length}</h2></div>
      <div className="card"><span className="badge">Clientes ativos</span><h2>{ativos.length}</h2></div>
      <div className="card"><span className="badge">Renovações</span><h2>{renovacoes.length}</h2></div>
    </section>

    <section className="grid" style={{marginTop:24}}>
      <div className="card">
        <h2>Por status</h2>
        <table className="table"><tbody>{Object.entries(status).map(([name,total]) => <tr key={name}><td>{name}</td><td>{total}</td></tr>)}</tbody></table>
      </div>
      <div className="card">
        <h2>Por produto</h2>
        <table className="table"><tbody>{Object.entries(produtos).map(([name,total]) => <tr key={name}><td>{name}</td><td>{total}</td></tr>)}</tbody></table>
      </div>
    </section>

    <section className="card" style={{marginTop:24}}>
      <h2>Renovações cadastradas</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Nome</th><th>Telefone</th><th>Status</th><th>Seguradora</th><th>Placa</th><th>Vencimento</th><th>Lembrete</th></tr></thead>
          <tbody>{renovacoes.map((lead:any) => <tr key={lead.id}><td>{lead.nome || '-'}</td><td>{lead.telefone}</td><td>{lead.status}</td><td>{lead.insurer || '-'}</td><td>{lead.vehicle_plate || '-'}</td><td>{lead.renewal_date || '-'}</td><td>{formatDate(lead.renewal_reminder_at || lead.next_followup_at)}</td></tr>)}</tbody>
        </table>
      </div>
    </section>

    <section className="card" style={{marginTop:24}}>
      <h2>Últimos leads atualizados</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Telefone</th><th>Produto</th><th>Status</th><th>Motivo</th><th>Próximo contato</th><th>Resumo</th></tr></thead>
          <tbody>{leads.slice(0,100).map((lead:any) => <tr key={lead.id}><td>{lead.telefone}</td><td>{lead.produto}</td><td>{lead.status}</td><td>{lead.close_reason || '-'}</td><td>{formatDate(lead.next_followup_at)}</td><td>{lead.resumo || '-'}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  </main>;
}
