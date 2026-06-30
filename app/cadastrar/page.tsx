import CadastroForm from './CadastroForm';

export const dynamic = 'force-dynamic';

export default function CadastrarPage() {
  return <main className="wrap">
    <header className="hero">
      <div>
        <span className="badge">Cadastro manual</span>
        <h1>Cadastrar lead ou cliente</h1>
        <p className="muted">Use para incluir lead novo, cliente ativo, renovação futura de seguro auto/moto ou caso finalizado.</p>
      </div>
      <div className="actions"><a className="btn secondary" href="/">Voltar ao painel</a></div>
    </header>

    <section className="card">
      <CadastroForm />
    </section>
  </main>;
}
