import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <header className="topbar">
        <div className="container topbar-inner">
          <div className="brand">PORTAL DO GRÊMIO ESTUDANTIL</div>
          <span>Eleição escolar</span>
        </div>
      </header>

      <section className="hero container">
        <h1>Eleição do Grêmio Estudantil</h1>
        <p>Um único portal para a urna eletrônica e para a comissão eleitoral. As urnas podem funcionar simultaneamente e os votos ficam centralizados no banco conectado ao Google Sheets.</p>
      </section>

      <section className="cards container">
        <Link href="/urna" className="card-link">
          <div className="icon">🗳️</div>
          <h2>Urna eletrônica</h2>
          <p>Identifique o eleitor pelo RA, confirme os dados, escolha a chapa e finalize o voto.</p>
        </Link>
        <Link href="/admin" className="card-link">
          <div className="icon">🔐</div>
          <h2>Administrativo</h2>
          <p>Cadastre as chapas, controle a eleição e acompanhe a apuração em tempo quase real.</p>
        </Link>
      </section>
    </main>
  );
}
