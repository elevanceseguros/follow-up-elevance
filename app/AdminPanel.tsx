import { approveFollowup, markColdFollowup, skipFollowup } from './adminActions';

type Approval = {
  id: string;
  lead_id: string;
  nome: string | null;
  telefone: string;
  produto: string;
  lead_status: string;
  mensagem: string;
  ai_payload?: any;
  created_at: string;
};

export default function AdminPanel({ approvals }: { approvals: Approval[] }) {
  return <section className="card admin-card">
    <div className="admin-header">
      <div>
        <span className="badge">Modo aprovação</span>
        <h2>Follow-ups pendentes</h2>
        <p className="muted">O n8n gera as mensagens de hora em hora. Aqui você revisa, edita e aprova o envio pelo WhatsApp.</p>
      </div>
      <a className="btn secondary refresh-link" href="/">Atualizar painel</a>
    </div>

    {approvals.length === 0 ? <div className="empty">
      <h3>Nenhuma mensagem pendente agora</h3>
      <p className="muted">Quando o n8n rodar com <strong>send:false</strong> e encontrar leads vencidos, eles aparecerão aqui automaticamente.</p>
    </div> : <div className="approval-list">
      {approvals.map(item => <article className="approval" key={item.id}>
        <div className="approval-top">
          <div>
            <h3>{item.nome || 'Lead sem nome'}</h3>
            <p className="muted">{item.telefone} · {item.produto} · {item.lead_status}</p>
          </div>
          <span className="badge">Pendente</span>
        </div>

        {item.ai_payload?.resumo && <p><strong>Resumo:</strong> {item.ai_payload.resumo}</p>}
        {item.ai_payload?.acao_recomendada && <p><strong>Ação:</strong> {item.ai_payload.acao_recomendada}</p>}

        <form action={approveFollowup}>
          <input type="hidden" name="id" value={item.id} />
          <label className="field-label">Mensagem para enviar</label>
          <textarea name="mensagem" defaultValue={item.mensagem || ''} rows={4} />
          <div className="actions">
            <button className="btn success" type="submit">Aprovar e enviar</button>
          </div>
        </form>

        <div className="actions secondary-actions">
          <form action={skipFollowup}>
            <input type="hidden" name="id" value={item.id} />
            <button className="btn secondary" type="submit">Pular por 3 dias</button>
          </form>
          <form action={markColdFollowup}>
            <input type="hidden" name="id" value={item.id} />
            <button className="btn danger" type="submit">Marcar frio</button>
          </form>
        </div>
      </article>)}
    </div>}
  </section>;
}
