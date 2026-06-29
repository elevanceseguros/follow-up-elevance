import { loginAction } from './actions';

export default function LoginPage() {
  return <main className="login-wrap">
    <section className="card login-card">
      <span className="badge">Elevance Seguros</span>
      <h1>Acesso interno</h1>
      <p className="muted">Entre para revisar e aprovar os follow-ups antes do envio pelo WhatsApp.</p>

      <form action={loginAction} className="login-form">
        <label className="field-label">E-mail</label>
        <input name="email" type="email" defaultValue="contato@elevanceseguros.com" required />

        <label className="field-label">Senha</label>
        <input name="password" type="password" required />

        <button className="btn success" type="submit">Entrar</button>
      </form>
    </section>
  </main>;
}
