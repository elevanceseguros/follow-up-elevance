'use client';

import { useEffect, useState } from 'react';

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

export default function AdminPanel() {
  const [secret, setSecret] = useState('');
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = window.localStorage.getItem('elevance_app_secret') || '';
    if (saved) setSecret(saved);
  }, []);

  async function api(action: string, payload: Record<string, any> = {}) {
    const res = await fetch('/api/admin/followups', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ appSecret: secret, action, ...payload })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Erro na requisição');
    return data;
  }

  async function load() {
    try {
      setLoading(true);
      setMessage('');
      window.localStorage.setItem('elevance_app_secret', secret);
      const data = await api('list');
      setApprovals(data.approvals || []);
      const edits: Record<string, string> = {};
      for (const item of data.approvals || []) edits[item.id] = item.mensagem || '';
      setEditing(edits);
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function approve(id: string) {
    if (!confirm('Enviar esta mensagem pelo WhatsApp agora?')) return;
    try {
      setLoading(true);
      await api('approve', { id, mensagem: editing[id] });
      setMessage('Mensagem aprovada e enviada com sucesso.');
      await load();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function skip(id: string) {
    try {
      setLoading(true);
      await api('skip', { id });
      setMessage('Follow-up pulado e reagendado.');
      await load();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function cold(id: string) {
    if (!confirm('Marcar este lead como frio e parar follow-ups?')) return;
    try {
      setLoading(true);
      await api('cold', { id });
      setMessage('Lead marcado como frio.');
      await load();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  return <section className="card admin-card">
    <div className="admin-header">
      <div>
        <span className="badge">Modo aprovação</span>
        <h2>Follow-ups pendentes</h2>
        <p className="muted">Revise, edite e aprove as mensagens antes de enviar pelo WhatsApp.</p>
      </div>
      <div className="secret-box">
        <input
          type="password"
          placeholder="APP_SECRET"
          value={secret}
          onChange={e => setSecret(e.target.value)}
        />
        <button className="btn" onClick={load} disabled={loading || !secret}>{loading ? 'Carregando...' : 'Atualizar'}</button>
      </div>
    </div>

    {message && <p className="notice">{message}</p>}

    {approvals.length === 0 ? <div className="empty">
      <h3>Nenhuma mensagem pendente agora</h3>
      <p className="muted">Quando o n8n rodar com <strong>send:false</strong> e encontrar leads vencidos, eles aparecerão aqui.</p>
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

        <label className="field-label">Mensagem para enviar</label>
        <textarea
          value={editing[item.id] || ''}
          onChange={e => setEditing(prev => ({ ...prev, [item.id]: e.target.value }))}
          rows={4}
        />

        <div className="actions">
          <button className="btn success" onClick={() => approve(item.id)} disabled={loading}>Aprovar e enviar</button>
          <button className="btn secondary" onClick={() => skip(item.id)} disabled={loading}>Pular por 3 dias</button>
          <button className="btn danger" onClick={() => cold(item.id)} disabled={loading}>Marcar frio</button>
        </div>
      </article>)}
    </div>}
  </section>;
}
