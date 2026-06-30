import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

type Params = { tipo?: string; inicio?: string; fim?: string };

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10) };
}

function reportTitle(type: string) {
  const map: Record<string,string> = {
    renovacoes_mes: 'Renovações do mês',
    leads_abertos: 'Leads em aberto',
    frios: 'Leads frios',
    fechou_outro: 'Fecharam em outro lugar',
    nao_interesse: 'Não querem / sem interesse',
    clientes_ativos: 'Clientes ativos',
    todos: 'Todos os registros'
  };
  return map[type] || map.todos;
}

function productLabel(value?: string | null) {
  const map: Record<string,string> = {
    plano_saude: 'Plano de saúde',
    seguro_auto: 'Seguro auto',
    seguro_moto: 'Seguro moto',
    seguro_residencial: 'Seguro residencial',
    seguro_vida: 'Seguro de vida',
    seguro_empresarial: 'Seguro empresarial',
    seguro_garantia: 'Seguro garantia',
    seguro_rc: 'Seguro RC',
    consorcio: 'Consórcio',
    protecao_veicular: 'Proteção veicular',
    outro: 'Outro'
  };
  return map[value || ''] || value || '-';
}

function statusLabel(value?: string | null) {
  const map: Record<string,string> = {
    nao_respondeu: 'Não respondeu',
    vou_pensar: 'Vai pensar',
    achou_caro: 'Achou caro',
    nao_quer_agora: 'Frio',
    cliente_ativo: 'Cliente ativo',
    renovacao_futura: 'Renovação futura',
    finalizado: 'Finalizado',
    aprovou: 'Aprovou',
    duvida: 'Dúvida',
    pediu_alteracao: 'Pediu alteração'
  };
  return map[value || ''] || value || '-';
}

function clientName(lead: any) {
  if (lead.nome) return lead.nome;
  const resumo = String(lead.resumo || '');
  const patterns = [
    /(?:nome|cliente)[:\- ]+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÀ-ÿ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÀ-ÿ]+){0,3})/i,
    /^([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÀ-ÿ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÀ-ÿ]+){0,2})[,\- ]/,
    /(?:sou|aqui é|aqui e)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÀ-ÿ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÀ-ÿ]+){0,2})/i
  ];
  for (const pattern of patterns) {
    const found = resumo.match(pattern)?.[1]?.trim();
    if (found && found.length >= 3 && !/^(oi|ola|olá|bom|boa|por|quero|tenho)$/i.test(found)) return found;
  }
  return 'Sem nome';
}

function subject(lead: any) {
  const parts = [productLabel(lead.produto)];
  if (lead.insurer) parts.push(lead.insurer);
  if (lead.vehicle_plate) parts.push(`Placa ${lead.vehicle_plate}`);
  if (lead.renewal_date) parts.push(`Venc. ${lead.renewal_date}`);
  return parts.filter(Boolean).join(' · ');
}

function nextAction(lead: any, tipo: string) {
  if (lead.renewal_date) return `Renovar/vigência em ${lead.renewal_date}`;
  if (lead.renewal_reminder_at) return `Lembrar em ${formatDate(lead.renewal_reminder_at)}`;
  if (lead.next_followup_at) return `Chamar em ${formatDate(lead.next_followup_at)}`;
  if (lead.close_reason === 'perdido_fechou_outro_lugar') return 'Registrar perda; não insistir';
  if (lead.close_reason === 'nao_tem_interesse') return 'Não insistir; manter histórico';
  if (lead.status === 'cliente_ativo') return 'Pós-venda / relacionamento';
  return tipo === 'todos' ? 'Sem ação cadastrada' : '-';
}

export default async function RelatoriosPage({ searchParams }: { searchParams?: Params | Promise<Params> }) {
  const params = searchParams ? await Promise.resolve(searchParams) : {};
  const supabaseAdmin = getSupabaseAdmin();
  const month = currentMonthRange();
  const tipo = params?.tipo || 'renovacoes_mes';
  const inicio = params?.inicio || month.start;
  const fim = params?.fim || month.end;

  let query = supabaseAdmin.from('leads').select('*').limit(1000);

  if (tipo === 'renovacoes_mes') {
    query = query.gte('renewal_date', inicio).lte('renewal_date', fim).order('renewal_date', { ascending: true });
  } else if (tipo === 'leads_abertos') {
    query = query.in('status', ['nao_respondeu','vou_pensar','achou_caro','nao_quer_agora']).order('updated_at', { ascending: false });
  } else if (tipo === 'frios') {
    query = query.eq('status', 'nao_quer_agora').order('updated_at', { ascending: false });
  } else if (tipo === 'fechou_outro') {
    query = query.eq('close_reason', 'perdido_fechou_outro_lugar').order('updated_at', { ascending: false });
  } else if (tipo === 'nao_interesse') {
    query = query.eq('close_reason', 'nao_tem_interesse').order('updated_at', { ascending: false });
  } else if (tipo === 'clientes_ativos') {
    query = query.eq('status', 'cliente_ativo').order('updated_at', { ascending: false });
  } else {
    query = query.order('updated_at', { ascending: false });
  }

  const { data, error } = await query;
  const leads = data || [];

  return <main className="wrap report-page">
    <header className="hero no-print">
      <div>
        <span className="badge">Relatórios</span>
        <h1>Gerar relatório</h1>
        <p className="muted">Escolha o tipo de relatório e gere uma lista objetiva para ação.</p>
      </div>
      <div className="report-actions">
        <a className="btn secondary" href="/">Voltar ao painel</a>
        <a className="btn secondary" href="/cadastrar">Cadastrar lead/cliente</a>
      </div>
    </header>

    <section className="card no-print" style={{marginBottom:24}}>
      <form>
        <div className="mini-grid">
          <div>
            <label className="field-label">Tipo de relatório</label>
            <select name="tipo" defaultValue={tipo}>
              <option value="renovacoes_mes">Renovações do mês</option>
              <option value="leads_abertos">Leads em aberto</option>
              <option value="frios">Leads frios</option>
              <option value="fechou_outro">Fecharam em outro lugar</option>
              <option value="nao_interesse">Não querem / sem interesse</option>
              <option value="clientes_ativos">Clientes ativos</option>
              <option value="todos">Todos os registros</option>
            </select>
          </div>
          <div>
            <label className="field-label">Início</label>
            <input type="date" name="inicio" defaultValue={inicio} />
          </div>
          <div>
            <label className="field-label">Fim</label>
            <input type="date" name="fim" defaultValue={fim} />
          </div>
        </div>
        <div className="actions"><button className="btn success" type="submit">Gerar relatório</button></div>
      </form>
    </section>

    {error && <section className="card"><strong>Erro:</strong><p className="muted">{error.message}</p></section>}

    <section className="card report-sheet">
      <div className="report-title">
        <div>
          <span className="badge">Elevance Seguros</span>
          <h1>{reportTitle(tipo)}</h1>
          <p className="muted">Emitido em {new Date().toLocaleString('pt-BR')} · Total: {leads.length}</p>
          {tipo === 'renovacoes_mes' && <p className="muted">Período: {inicio} até {fim}</p>}
        </div>
        <div className="no-print"><PrintButton /></div>
      </div>

      {leads.length === 0 ? <div className="empty"><h3>Nenhum registro encontrado</h3><p className="muted">Tente outro tipo de relatório ou ajuste o período.</p></div> : <div className="table-wrap report-table-wrap">
        <table className="table report-table">
          <thead><tr><th>Cliente</th><th>Contato</th><th>Do que se trata</th><th>Situação</th><th>Próxima ação</th><th>Observações</th></tr></thead>
          <tbody>{leads.map((lead:any) => <tr key={lead.id}>
            <td>{clientName(lead)}</td>
            <td>{lead.telefone}</td>
            <td>{subject(lead)}</td>
            <td>{statusLabel(lead.status)}</td>
            <td>{nextAction(lead, tipo)}</td>
            <td>{lead.resumo || '-'}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </main>;
}
