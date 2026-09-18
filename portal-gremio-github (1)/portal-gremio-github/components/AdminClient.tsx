'use client';

import { useEffect, useState, type FormEvent } from 'react';

type Chapa = { numero:string; nome:string; presidente:string; vice:string; slogan:string; foto:string; votos?:number };
type Stats = { totalEleitores:number; votaram:number; faltam:number; totalVotos:number; brancos:number; nulos:number; porChapa:{numero:string; nome:string; votos:number}[]; status:string; titulo:string; escola:string };

export default function AdminClient() {
  const [password, setPassword] = useState('');
  const [logged, setLogged] = useState(false);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [chapas, setChapas] = useState<Chapa[]>([]);
  const [form, setForm] = useState<Chapa>({numero:'',nome:'',presidente:'',vice:'',slogan:'',foto:''});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('gremio_admin_password');
    if (saved) { setPassword(saved); setLogged(true); }
  }, []);

  useEffect(() => {
    if (!logged) return;
    refresh();
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [logged]);

  async function api(body: Record<string, unknown>) {
    const res = await fetch('/api/gremio', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), cache:'no-store' });
    return res.json();
  }

  async function login(e: FormEvent) {
    e.preventDefault(); setMessage(''); setLoading(true);
    try {
      const data = await api({action:'stats', password});
      if (!data.ok) throw new Error(data.message || 'Senha inválida.');
      sessionStorage.setItem('gremio_admin_password', password); setLogged(true); setStats(data); loadChapas();
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Não foi possível entrar.'); }
    finally { setLoading(false); }
  }

  async function loadChapas() {
    const res = await fetch('/api/gremio?action=chapas', {cache:'no-store'}).then(r=>r.json());
    if (res.ok) setChapas(res.chapas || []);
  }

  async function refresh() {
    try {
      const data = await api({action:'stats', password});
      if (data.ok) setStats(data);
      const cs = await fetch('/api/gremio?action=chapas', {cache:'no-store'}).then(r=>r.json());
      if (cs.ok) setChapas(cs.chapas || []);
    } catch { /* polling silencioso */ }
  }

  async function saveChapa(e: FormEvent) {
    e.preventDefault(); setLoading(true); setMessage('');
    try {
      const data = await api({action:'save_chapa', password, ...form});
      if (!data.ok) throw new Error(data.message || 'Erro ao salvar chapa.');
      setMessage('Chapa salva com sucesso.'); setForm({numero:'',nome:'',presidente:'',vice:'',slogan:'',foto:''}); refresh();
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Erro ao salvar chapa.'); }
    finally { setLoading(false); }
  }

  async function changeStatus(status: 'ABERTA'|'FECHADA') {
    const data = await api({action:'set_status', password, status});
    setMessage(data.ok ? `Votação ${status === 'ABERTA' ? 'aberta' : 'encerrada'}.` : (data.message || 'Erro.'));
    refresh();
  }

  async function deleteChapa(numero: string) {
    if (!confirm(`Excluir a chapa ${numero}?`)) return;
    const data = await api({action:'delete_chapa', password, numero});
    setMessage(data.ok ? 'Chapa removida.' : (data.message || 'Erro.')); refresh();
  }

  function exportCsv() {
    if (!stats) return;
    const rows = [
      ['Resultado','Votos'],
      ...stats.porChapa.map(x => [`${x.numero} - ${x.nome}`, x.votos]),
      ['Votos em branco', stats.brancos],
      ['Votos nulos', stats.nulos],
      ['Total de votos', stats.totalVotos],
      ['Total de eleitores', stats.totalEleitores],
      ['Participação (%)', stats.totalEleitores ? ((stats.votaram/stats.totalEleitores)*100).toFixed(2) : '0.00'],
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='apuracao-gremio.csv'; a.click(); URL.revokeObjectURL(url);
  }

  if (!logged) return (
    <main>
      <header className="topbar"><div className="container topbar-inner"><div className="brand">PORTAL DO GRÊMIO ESTUDANTIL</div><span>Administrativo</span></div></header>
      <form className="login-box" onSubmit={login}>
        <h1>Área administrativa</h1>
        <p className="muted">Entre com a senha da comissão eleitoral.</p>
        <label>Senha</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoFocus />
        {message && <div className="alert">{message}</div>}
        <button className="btn btn-blue" disabled={loading}>{loading ? 'Entrando...' : 'ENTRAR'}</button>
      </form>
    </main>
  );

  return (
    <main>
      <header className="topbar"><div className="container topbar-inner"><div className="brand">PORTAL DO GRÊMIO ESTUDANTIL</div><div>Comissão Eleitoral</div></div></header>
      <div className="admin-main container">
        <div className="admin-head">
          <div><h1>Painel administrativo</h1><div className="muted">{stats?.escola || 'Escola'} • {stats?.titulo || 'Eleição do Grêmio'}</div></div>
          <div className="admin-actions">
            {stats?.status === 'ABERTA' ? <button className="btn btn-red" onClick={()=>changeStatus('FECHADA')}>ENCERRAR VOTAÇÃO</button> : <button className="btn btn-green" onClick={()=>changeStatus('ABERTA')}>ABRIR VOTAÇÃO</button>}
            <button className="btn btn-light" onClick={exportCsv}>EXPORTAR APURAÇÃO</button>
            <button className="btn btn-dark" onClick={()=>{sessionStorage.removeItem('gremio_admin_password');setLogged(false);}}>SAIR</button>
          </div>
        </div>

        {message && <div className="alert success" style={{marginBottom:16}}>{message}</div>}

        <div className="stats-grid">
          <div className="stat"><div className="label">Status</div><div className="value" style={{fontSize:22}}><span className={`badge ${stats?.status==='ABERTA'?'badge-open':'badge-closed'}`}>{stats?.status || '—'}</span></div></div>
          <div className="stat"><div className="label">Eleitores cadastrados</div><div className="value">{stats?.totalEleitores ?? '—'}</div></div>
          <div className="stat"><div className="label">Já votaram</div><div className="value">{stats?.votaram ?? '—'}</div></div>
          <div className="stat"><div className="label">Participação</div><div className="value">{stats ? `${stats.totalEleitores ? ((stats.votaram/stats.totalEleitores)*100).toFixed(1) : '0.0'}%` : '—'}</div></div>
        </div>

        <section className="panel">
          <h2>Apuração em tempo quase real</h2>
          <div className="table-wrap"><table><thead><tr><th>Chapa</th><th>Votos</th><th>% dos votos</th><th></th></tr></thead><tbody>
            {(stats?.porChapa || []).map(x=><tr key={x.numero}><td><strong>{x.numero}</strong> — {x.nome}</td><td>{x.votos}</td><td>{stats?.totalVotos ? ((x.votos/stats.totalVotos)*100).toFixed(1) : '0.0'}%</td><td></td></tr>)}
            <tr><td><strong>BRANCO</strong></td><td>{stats?.brancos ?? 0}</td><td>{stats?.totalVotos ? (((stats.brancos)/(stats.totalVotos))*100).toFixed(1) : '0.0'}%</td><td></td></tr>
            <tr><td><strong>NULO</strong></td><td>{stats?.nulos ?? 0}</td><td>{stats?.totalVotos ? (((stats.nulos)/(stats.totalVotos))*100).toFixed(1) : '0.0'}%</td><td></td></tr>
          </tbody></table></div>
          <p className="muted">Atualização automática a cada 4 segundos. Total de votos: <strong>{stats?.totalVotos ?? 0}</strong>. Faltam votar: <strong>{stats?.faltam ?? 0}</strong>.</p>
        </section>

        <section className="panel">
          <h2>Cadastrar / editar chapa</h2>
          <form className="form-grid" onSubmit={saveChapa}>
            <div className="field"><label>Número</label><input value={form.numero} onChange={e=>setForm({...form,numero:e.target.value.replace(/\D/g,'').slice(0,3)})} required /></div>
            <div className="field"><label>Nome da chapa</label><input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} required /></div>
            <div className="field"><label>Presidente</label><input value={form.presidente} onChange={e=>setForm({...form,presidente:e.target.value})} /></div>
            <div className="field"><label>Vice-presidente</label><input value={form.vice} onChange={e=>setForm({...form,vice:e.target.value})} /></div>
            <div className="field"><label>Slogan</label><input value={form.slogan} onChange={e=>setForm({...form,slogan:e.target.value})} /></div>
            <div className="field"><label>URL da foto pública</label><input value={form.foto} onChange={e=>setForm({...form,foto:e.target.value})} placeholder="https://..." /></div>
            <div className="field full"><button className="btn btn-blue" disabled={loading}>{loading ? 'Salvando...' : 'SALVAR CHAPA'}</button></div>
          </form>
        </section>

        <section className="panel">
          <h2>Chapas cadastradas</h2>
          <div className="table-wrap"><table><thead><tr><th>Número</th><th>Chapa</th><th>Presidente</th><th>Vice</th><th>Ação</th></tr></thead><tbody>
            {chapas.map(c=><tr key={c.numero}><td><strong>{c.numero}</strong></td><td>{c.nome}</td><td>{c.presidente || '—'}</td><td>{c.vice || '—'}</td><td><button className="btn btn-light" onClick={()=>setForm(c)}>Editar</button>{' '}<button className="btn btn-red" onClick={()=>deleteChapa(c.numero)}>Excluir</button></td></tr>)}
          </tbody></table></div>
        </section>

        <section className="panel">
          <h2>Planilha de eleitores</h2>
          <p className="muted">O cadastro dos alunos fica na planilha do Google Sheets. O sistema usa RA, nome, data de nascimento e o marcador de participação para validar e impedir novo voto.</p>
          <p><strong>Votaram:</strong> {stats?.votaram ?? 0} &nbsp; • &nbsp; <strong>Faltam:</strong> {stats?.faltam ?? 0}</p>
        </section>
      </div>
    </main>
  );
}
