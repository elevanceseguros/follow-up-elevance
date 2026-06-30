import { createLead } from './actions';

export const dynamic = 'force-dynamic';

export default function CadastrarPage() {
  return <main className="wrap">
    <header className="hero">
      <div>
        <span className="badge">Cadastro manual</span>
        <h1>Cadastrar lead ou cliente</h1>
        <p className="muted">Use para incluir lead novo, cliente ativo, renovação futura de seguro auto ou caso finalizado.</p>
      </div>
      <div className="actions"><a className="btn secondary" href="/">Voltar ao painel</a></div>
    </header>

    <section className="card">
      <form action={createLead}>
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
            <select name="produto" defaultValue="plano_saude">
              <option value="plano_saude">Plano de saúde</option>
              <option value="seguro_auto">Seguro auto</option>
              <option value="seguro_moto">Seguro moto</option>
              <option value="seguro_vida">Seguro de vida</option>
              <option value="consorcio">Consórcio</option>
              <option value="protecao_veicular">Proteção veicular</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <div>
            <label className="field-label">Situação</label>
            <select name="status" defaultValue="nao_respondeu">
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
        <textarea name="resumo" rows={4} placeholder="Ex: cotou seguro auto, vencimento em setembro, pediu para chamar perto da renovação..." />

        <h2 style={{marginTop:24}}>Dados de seguro/renovação</h2>
        <div className="mini-grid">
          <div>
            <label className="field-label">Seguradora/operadora</label>
            <input name="insurer" placeholder="Ex: Porto, Azul, SulAmérica..." />
          </div>
          <div>
            <label className="field-label">Nº apólice/proposta</label>
            <input name="policy_number" />
          </div>
          <div>
            <label className="field-label">Placa</label>
            <input name="vehicle_plate" placeholder="ABC1D23" />
          </div>
          <div>
            <label className="field-label">Vencimento da apólice</label>
            <input type="date" name="renewal_date" />
          </div>
          <div>
            <label className="field-label">Próximo contato manual</label>
            <input type="date" name="next_contact_date" />
          </div>
        </div>

        <div className="actions" style={{marginTop:24}}>
          <button className="btn success" type="submit">Salvar cadastro</button>
        </div>
      </form>
    </section>
  </main>;
}
