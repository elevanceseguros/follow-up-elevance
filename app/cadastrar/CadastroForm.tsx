'use client';

import { useState } from 'react';
import { createLead } from './actions';

const renewalProducts = [
  'seguro_auto',
  'seguro_moto',
  'seguro_residencial',
  'seguro_vida',
  'seguro_empresarial',
  'seguro_garantia',
  'seguro_rc'
];

export default function CadastroForm() {
  const [produto, setProduto] = useState('plano_saude');
  const [status, setStatus] = useState('nao_respondeu');

  const showPolicy = renewalProducts.includes(produto) || ['cliente_ativo', 'renovacao_futura'].includes(status);
  const showPlate = ['seguro_auto', 'seguro_moto'].includes(produto);

  return <form action={createLead}>
    <div className="mini-grid">
      <div>
        <label className="field-label">Nome</label>
        <input name="nome" placeholder="Nome do cliente" />
      </div>
      <div>
        <label className="field-label">Telefone/WhatsApp</label>
        <input name="telefone" placeholder="11999999999" required />
      </div>
      <div>
        <label className="field-label">Produto</label>
        <select name="produto" value={produto} onChange={(event) => setProduto(event.target.value)}>
          <option value="plano_saude">Plano de saúde</option>
          <option value="seguro_auto">Seguro auto</option>
          <option value="seguro_moto">Seguro moto</option>
          <option value="seguro_residencial">Seguro residencial</option>
          <option value="seguro_vida">Seguro de vida</option>
          <option value="seguro_empresarial">Seguro empresarial</option>
          <option value="seguro_garantia">Seguro garantia</option>
          <option value="seguro_rc">Seguro RC</option>
          <option value="consorcio">Consórcio</option>
          <option value="protecao_veicular">Proteção veicular</option>
          <option value="outro">Outro</option>
        </select>
      </div>
      <div>
        <label className="field-label">Situação</label>
        <select name="status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="nao_respondeu">Lead em aberto / não respondeu</option>
          <option value="vou_pensar">Vai pensar</option>
          <option value="achou_caro">Achou caro</option>
          <option value="nao_quer_agora">Frio / não quer agora</option>
          <option value="cliente_ativo">Cliente ativo / fechou conosco</option>
          <option value="renovacao_futura">Renovação futura</option>
          <option value="finalizado">Finalizado</option>
        </select>
      </div>
    </div>

    <label className="field-label">Resumo/observações</label>
    <textarea name="resumo" rows={4} placeholder="Ex: cotou plano de saúde para família, pediu para retornar semana que vem..." />

    {showPolicy && <section className="conditional-box">
      <h2>Dados da apólice / vigência / renovação</h2>
      <p className="muted">Use para seguros com vigência, renovação, aniversário de apólice ou prorrogação. Para plano de saúde, use apenas próximo contato/aniversário em observações por enquanto.</p>
      <div className="mini-grid">
        <div>
          <label className="field-label">Seguradora/operadora</label>
          <input name="insurer" placeholder="Ex: Porto, Azul, SulAmérica..." />
        </div>
        <div>
          <label className="field-label">Nº apólice/proposta</label>
          <input name="policy_number" />
        </div>
        {showPlate && <div>
          <label className="field-label">Placa</label>
          <input name="vehicle_plate" placeholder="ABC1D23" />
        </div>}
        <div>
          <label className="field-label">Vencimento / fim de vigência</label>
          <input type="date" name="renewal_date" />
        </div>
      </div>
    </section>}

    <section className="conditional-box subtle-box">
      <h2>Próximo contato</h2>
      <p className="muted">Use quando quiser agendar um retorno manual. Para seguros com vigência, o sistema também pode usar o vencimento para lembrar 30 dias antes.</p>
      <div className="mini-grid">
        <div>
          <label className="field-label">Data do próximo contato</label>
          <input type="date" name="next_contact_date" />
        </div>
      </div>
    </section>

    <div className="actions" style={{marginTop:24}}>
      <button className="btn success" type="submit">Salvar cadastro</button>
    </div>
  </form>;
}
