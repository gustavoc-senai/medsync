export default function AppRecovery() {
  return <main className="app-loading">
    <h1>Não foi possível abrir esta tela</h1>
    <p>Recarregue para tentar novamente. Se o sistema acabou de ser atualizado, isso também carrega a versão mais recente.</p>
    <button className="button button-primary" onClick={() => window.location.reload()}>Recarregar sistema</button>
    <a className="text-link" href="/">Voltar ao início</a>
  </main>;
}
