'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
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

type CardState = {
  status: 'idle' | 'sending' | 'success' | 'error';
  message: string;
};

function SubmitButton({ idle, pending }: { idle: string; pending: string }) {
  const formStatus = useFormStatus();
  return <button className="btn success" type="submit" disabled={formStatus.pending}>{formStatus.pending ? pending : idle}</button>;
}

function ActionButton({ idle, pending, className }: { idle: string; pending: string; className: string }) {
  const formStatus = useFormStatus();
  return <button className={className} type="submit" disabled={formStatus.pending}>{formStatus.pending ? pending : idle}</button>;
}

export default function AdminPanel({ approvals }: { approvals: Approval[] }) {
  const [cards, setCards] = useState<Record<string, CardState>>({});

  function setCard(id: string, state: CardState) {
    setCards(current => ({ ...current, [id]: state }));
  }

  async function approveAction(formData: FormData) {
    const id = String(formData.get('id') || '');
    setCard(id, { status: 'sending', message: 'Enviando pelo WhatsApp...' });
    try {
      await approveFollowup(formData);
      setCard(id, { status: 'success', message: 'Mensagem enviada com sucesso. Este card sairá na próxima atualização.' });
    } catch (error: any) {
      setCard(id, { status: 'error', message: error?.message || 'Erro ao enviar. Tente novamente.' });
    }
  }

  async function skipAction(formData: FormData) {
    const id = String(formData.get('id') || '');
    setCard(id, { status: 'sending', message: 'Pulando e reagendando para daqui 3 dias...' });
    try {
      await skipFollowup(formData);
      setCard(id, { status: 'success', message: 'Follow-up pulado por 3 dias. Este card sairá na próxima atualização.' });
    } catch (error: any) {
      setCard(id, { status: 'error', message: error?.message || 'Erro ao pular. Tente novamente.' });
    }
  }

  async function coldAction(formData: FormData) {
    const id = String(formData.get('id') || '');
    setCard(id, { status: 'sending', message: 'Marcando lead como frio...' });
    try {
      await markColdFollowup(formData);
      setCard(id, { status: 'success', message: 'Lead marcado como frio. Este card sairá na próxima atualização.' });
    } catch (error: any) {
      setCard(id, { status: 'error', message: error?.message || 'Erro ao marcar frio. Tente novamente.' });
    }
  }

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
      {approvals.map(item => {
        const card = cards[item.id] || { status: 'idle', message: '' };
        const locked = card.status === 'sending' || card.status === 'success';

        return <article className={`approval ${card.status !== 'idle' ? `approval-${card.status}` : ''}`} key={item.id}>
          <div className="approval-top">
            <div>
              <h3>{item.nome || 'Lead sem nome'}</h3>
              <p className="muted">{item.telefone} · {item.produto} · {item.lead_status}</p>
            </div>
            <span className="badge">{card.status === 'success' ? 'Concluído' : card.status === 'sending' ? 'Processando' : card.status === 'error' ? 'Erro' : 'Pendente'}</span>
          </div>

          {card.message && <div className={`notice action-feedback ${card.status === 'error' ? 'feedback-error' : card.status === 'success' ? 'feedback-success' : ''}`}>{card.message}</div>}

          {item.ai_payload?.resumo && <p><strong>Resumo:</strong> {item.ai_payload.resumo}</p>}
          {item.ai_payload?.acao_recomendada && <p><strong>Ação:</strong> {item.ai_payload.acao_recomendada}</p>}

          <form action={approveAction}>
            <input type="hidden" name="id" value={item.id} />
            <label className="field-label">Mensagem para enviar</label>
            <textarea name="mensagem" defaultValue={item.mensagem || ''} rows={4} disabled={locked} />
            <div className="actions">
              <SubmitButton idle="Aprovar e enviar" pending="Enviando..." />
            </div>
          </form>

          <div className="actions secondary-actions">
            <form action={skipAction}>
              <input type="hidden" name="id" value={item.id} />
              <ActionButton idle="Pular por 3 dias" pending="Pulando..." className="btn secondary" />
            </form>
            <form action={coldAction}>
              <input type="hidden" name="id" value={item.id} />
              <ActionButton idle="Marcar frio" pending="Marcando..." className="btn danger" />
            </form>
          </div>
        </article>;
      })}
    </div>}
  </section>;
}
