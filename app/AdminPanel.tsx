'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { approveFollowup, finishClient, markColdFollowup, markWonClient, scheduleRenewal, sendPostSale, skipFollowup } from './adminActions';

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

function SubmitButton({ idle, pending, className = 'btn success' }: { idle: string; pending: string; className?: string }) {
  const formStatus = useFormStatus();
  return <button className={className} type="submit" disabled={formStatus.pending}>{formStatus.pending ? pending : idle}</button>;
}

export default function AdminPanel({ approvals }: { approvals: Approval[] }) {
  const [cards, setCards] = useState<Record<string, CardState>>({});

  function setCard(id: string, state: CardState) {
    setCards(current => ({ ...current, [id]: state }));
  }

  async function runAction(formData: FormData, pending: string, success: string, fn: (formData: FormData) => Promise<void>) {
    const id = String(formData.get('id') || '');
    setCard(id, { status: 'sending', message: pending });
    try {
      await fn(formData);
      setCard(id, { status: 'success', message: success });
    } catch (error: any) {
      setCard(id, { status: 'error', message: error?.message || 'Erro ao executar ação. Tente novamente.' });
    }
  }

  const postSaleDefault = 'Oi! Passando para confirmar se ficou tudo certo com sua contratação e se você recebeu os dados direitinho. Qualquer dúvida, pode me chamar por aqui.';

  return <section className="card admin-card">
    <div className="admin-header">
      <div>
        <span className="badge">Modo aprovação</span>
        <h2>Follow-ups pendentes</h2>
        <p className="muted">Revise, aprove, finalize, cadastre renovação ou envie pós-venda pelo WhatsApp.</p>
      </div>
      <div className="actions"><a className="btn secondary refresh-link" href="/">Atualizar painel</a></div>
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

          <form action={(fd) => runAction(fd, 'Enviando pelo WhatsApp...', 'Mensagem enviada com sucesso. Este card sairá na próxima atualização.', approveFollowup)}>
            <input type="hidden" name="id" value={item.id} />
            <label className="field-label">Mensagem para enviar</label>
            <textarea name="mensagem" defaultValue={item.mensagem || ''} rows={4} disabled={locked} />
            <div className="actions">
              <SubmitButton idle="Aprovar e enviar" pending="Enviando..." />
            </div>
          </form>

          <div className="actions secondary-actions">
            <form action={(fd) => runAction(fd, 'Pulando e reagendando para daqui 3 dias...', 'Follow-up pulado por 3 dias. Este card sairá na próxima atualização.', skipFollowup)}>
              <input type="hidden" name="id" value={item.id} />
              <SubmitButton idle="Pular por 3 dias" pending="Pulando..." className="btn secondary" />
            </form>
            <form action={(fd) => runAction(fd, 'Marcando lead como frio...', 'Lead marcado como frio. Este card sairá na próxima atualização.', markColdFollowup)}>
              <input type="hidden" name="id" value={item.id} />
              <SubmitButton idle="Marcar frio" pending="Marcando..." className="btn danger" />
            </form>
            <form action={(fd) => runAction(fd, 'Finalizando cliente...', 'Cliente finalizado. Este card sairá na próxima atualização.', finishClient)}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="reason" value="finalizado_manual" />
              <SubmitButton idle="Cliente finalizado" pending="Finalizando..." className="btn secondary" />
            </form>
            <form action={(fd) => runAction(fd, 'Marcando como perdido...', 'Marcado como fechou em outro lugar. Este card sairá na próxima atualização.', finishClient)}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="reason" value="perdido_fechou_outro_lugar" />
              <SubmitButton idle="Fechou em outro lugar" pending="Marcando..." className="btn danger" />
            </form>
            <form action={(fd) => runAction(fd, 'Marcando sem interesse...', 'Marcado como não tem interesse. Este card sairá na próxima atualização.', finishClient)}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="reason" value="nao_tem_interesse" />
              <SubmitButton idle="Não quer" pending="Marcando..." className="btn danger" />
            </form>
          </div>

          <details className="details-box">
            <summary>Fechou conosco / pós-venda / renovação</summary>
            <div className="mini-grid">
              <form action={(fd) => runAction(fd, 'Salvando cliente ativo...', 'Cliente salvo como ativo e pós-venda/renovação programado.', markWonClient)}>
                <input type="hidden" name="id" value={item.id} />
                <label className="field-label">Produto fechado</label>
                <select name="product" defaultValue={item.produto || 'plano_saude'}>
                  <option value="plano_saude">Plano de saúde</option>
                  <option value="seguro_auto">Seguro auto</option>
                  <option value="seguro_vida">Seguro de vida</option>
                  <option value="consorcio">Consórcio</option>
                  <option value="outro">Outro</option>
                </select>
                <input name="insurer" placeholder="Seguradora/operadora" />
                <input name="policy_number" placeholder="Nº apólice/proposta" />
                <input name="plate" placeholder="Placa, se for auto" />
                <label className="field-label">Vencimento da apólice, se tiver</label>
                <input type="date" name="renewal_date" />
                <div className="actions"><SubmitButton idle="Fechou conosco" pending="Salvando..." className="btn success" /></div>
              </form>

              <form action={(fd) => runAction(fd, 'Cadastrando renovação...', 'Renovação futura cadastrada.', scheduleRenewal)}>
                <input type="hidden" name="id" value={item.id} />
                <label className="field-label">Renovação seguro auto</label>
                <input type="date" name="renewal_date" required />
                <input name="insurer" placeholder="Seguradora atual" />
                <input name="policy_number" placeholder="Nº apólice" />
                <input name="plate" placeholder="Placa" />
                <div className="actions"><SubmitButton idle="Cadastrar renovação" pending="Cadastrando..." className="btn secondary" /></div>
              </form>
            </div>

            <form action={(fd) => runAction(fd, 'Enviando pós-venda...', 'Mensagem de pós-venda enviada.', sendPostSale)}>
              <input type="hidden" name="id" value={item.id} />
              <label className="field-label">Mensagem pós-venda</label>
              <textarea name="mensagem_pos_venda" defaultValue={postSaleDefault} rows={3} disabled={locked} />
              <div className="actions"><SubmitButton idle="Enviar pós-venda" pending="Enviando..." className="btn success" /></div>
            </form>
          </details>
        </article>;
      })}
    </div>}
  </section>;
}
