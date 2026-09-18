'use client';

import { useEffect, useMemo, useState } from 'react';

type Student = { ra: string; nome: string; nascimento: string; jaVotou: boolean };
type Chapa = { numero: string; nome: string; presidente: string; vice: string; slogan: string; foto: string };
type Step = 'ra' | 'confirm-student' | 'vote' | 'confirm-vote' | 'fim';

function digitsOnly(s: string) { return s.replace(/\D/g, ''); }

export default function UrnaClient() {
  const [step, setStep] = useState<Step>('ra');
  const [ra, setRa] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [chapas, setChapas] = useState<Chapa[]>([]);
  const [chapaNumber, setChapaNumber] = useState('');
  const [selectedChapa, setSelectedChapa] = useState<Chapa | null>(null);
  const [selectedType, setSelectedType] = useState<'chapa'|'branco'|'nulo'|null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [urnaid, setUrnaId] = useState('01');
  const [electionOpen, setElectionOpen] = useState(true);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setUrnaId(p.get('urna') || '01');
    loadInitial();
  }, []);

  async function loadInitial() {
    try {
      const [c, s] = await Promise.all([
        fetch('/api/gremio?action=chapas', { cache: 'no-store' }).then(r => r.json()),
        fetch('/api/gremio?action=status', { cache: 'no-store' }).then(r => r.json()),
      ]);
      if (c.ok) setChapas(c.chapas || []);
      if (s.ok) setElectionOpen(s.status === 'ABERTA');
    } catch {
      setMessage('Não foi possível conectar ao servidor da eleição.');
    }
  }

  const currentLabel = useMemo(() => {
    if (step === 'ra') return 'IDENTIFICAÇÃO DO ELEITOR';
    if (step === 'confirm-student') return 'CONFIRMAÇÃO DO ELEITOR';
    if (step === 'vote' || step === 'confirm-vote') return 'VOTO PARA O GRÊMIO ESTUDANTIL';
    return 'VOTO REGISTRADO';
  }, [step]);

  async function findStudent() {
    if (!ra) { setMessage('Digite o RA do aluno.'); return; }
    if (!electionOpen) { setMessage('A votação está encerrada no momento.'); return; }
    setLoading(true); setMessage('');
    try {
      const res = await fetch(`/api/gremio?action=student&ra=${encodeURIComponent(ra)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || 'RA não localizado.');
      setStudent(data.student);
      if (data.student.jaVotou) throw new Error('Este RA já possui um voto registrado.');
      setStep('confirm-student');
    } catch (e) {
      setStudent(null);
      setMessage(e instanceof Error ? e.message : 'Erro ao consultar o RA.');
    } finally { setLoading(false); }
  }

  function confirmStudent() {
    setStep('vote'); setMessage('Digite o número da chapa.');
    setChapaNumber(''); setSelectedChapa(null); setSelectedType(null);
  }

  function keyPress(k: string) {
    if (step !== 'ra' && step !== 'vote') return;
    if (step === 'ra') setRa(prev => (prev + k).slice(0, 20));
    else {
      const next = (chapaNumber + k).slice(0, 3);
      setChapaNumber(next);
      const found = chapas.find(c => c.numero === next);
      if (found) { setSelectedChapa(found); setSelectedType('chapa'); setMessage('Confira os dados da chapa.'); }
      else if (next.length >= 2) { setSelectedChapa(null); setSelectedType('nulo'); setMessage('Número não cadastrado. O voto poderá ser confirmado como nulo.'); }
    }
  }

  function clearAll() {
    if (step === 'ra') setRa('');
    if (step === 'vote') { setChapaNumber(''); setSelectedChapa(null); setSelectedType(null); setMessage('Digite o número da chapa.'); }
  }

  function blank() {
    if (step !== 'vote') return;
    setChapaNumber(''); setSelectedChapa(null); setSelectedType('branco'); setMessage('VOTO EM BRANCO selecionado.');
  }

  function proceedVoteConfirm() {
    if (step !== 'vote' || !selectedType) { setMessage('Digite uma chapa ou selecione BRANCO.'); return; }
    setStep('confirm-vote');
  }

  async function registerVote() {
    if (!student || !selectedType) return;
    setLoading(true); setMessage('Registrando voto...');
    try {
      const res = await fetch('/api/gremio', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          action: 'vote',
          ra: student.ra,
          chapaNumero: selectedType === 'chapa' ? selectedChapa?.numero : selectedType === 'nulo' ? chapaNumber : '',
          tipo: selectedType,
          urna: urnaid,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || 'Não foi possível registrar o voto.');
      setStep('fim'); setMessage('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Erro ao registrar o voto.');
      setStep('vote');
    } finally { setLoading(false); }
  }

  function resetForNext() {
    setStep('ra'); setRa(''); setStudent(null); setChapaNumber(''); setSelectedChapa(null); setSelectedType(null); setMessage('');
  }

  return (
    <main className="urna-page">
      <header className="urna-header"><div className="urna-header-inner"><div className="urna-brand">URNA ELETRÔNICA • GRÊMIO ESTUDANTIL</div><div className="urna-id">URNA {urnaid.padStart(2,'0')}</div></div></header>
      <div className="urna-wrap">
        <section className="urna-body">
          <div className="urna-top"><div className="urna-top-title">{currentLabel}</div></div>
          <div className="urna-content">
            <div className="urna-screen-shell">
              <div className="urna-screen">
                <div className="screen-inner">
                  {step === 'ra' && <div>
                    <div className="screen-title">SEU RA</div>
                    <div className="screen-subtitle">Digite seu Registro do Aluno (RA) utilizando o teclado ao lado e pressione CONFIRMA.</div>
                    <div className="screen-center"><input className="big-input" readOnly value={ra} placeholder="RA" /></div>
                  </div>}

                  {step === 'confirm-student' && student && <div>
                    <div className="screen-title">CONFIRA SEUS DADOS</div>
                    <div className="screen-subtitle">Confira atentamente as informações antes de continuar.</div>
                    <div className="confirm-data">
                      <div className="confirm-data-grid">
                        <div className="data-item"><label>Nome</label><strong>{student.nome}</strong></div>
                        <div className="data-item"><label>Data de nascimento</label><strong>{student.nascimento}</strong></div>
                      </div>
                    </div>
                    <div className="screen-subtitle" style={{marginTop:16}}>Estão corretos os dados?</div>
                  </div>}

                  {step === 'vote' && <div>
                    <div className="screen-title">SEU VOTO PARA</div>
                    <div className="screen-subtitle">Digite o número da chapa e confira a identificação apresentada.</div>
                    <div className="screen-center" style={{marginBottom:14}}><input className="big-input" readOnly value={chapaNumber} placeholder="Nº DA CHAPA" /></div>
                    {selectedType === 'chapa' && selectedChapa && <div className="chapa-preview">
                      <div className="chapa-photo">{selectedChapa.foto ? <img src={selectedChapa.foto} alt={`Foto ${selectedChapa.nome}`} /> : <span style={{fontSize:42}}>👥</span>}</div>
                      <div><div className="chapa-number">{selectedChapa.numero}</div><div className="chapa-name">{selectedChapa.nome}</div><div className="chapa-meta">Presidente: {selectedChapa.presidente || '—'}<br/>Vice: {selectedChapa.vice || '—'}<br/>{selectedChapa.slogan || ''}</div></div>
                    </div>}
                    {selectedType === 'branco' && <div className="chapa-preview"><div style={{gridColumn:'1 / -1',textAlign:'center',fontWeight:900,fontSize:26}}>VOTO EM BRANCO</div></div>}
                    {selectedType === 'nulo' && <div className="chapa-preview"><div style={{gridColumn:'1 / -1',textAlign:'center',fontWeight:900,fontSize:26}}>VOTO NULO<br/><span style={{fontSize:14,fontWeight:400}}>Número não cadastrado</span></div></div>}
                  </div>}

                  {step === 'confirm-vote' && <div>
                    <div className="screen-title">CONFIRME SEU VOTO</div>
                    <div className="screen-subtitle">Confira novamente antes de pressionar CONFIRMA.</div>
                    {selectedType === 'chapa' && selectedChapa && <div className="confirm-data"><strong style={{fontSize:26}}>{selectedChapa.numero} — {selectedChapa.nome}</strong><p style={{marginBottom:0,color:'#555'}}>Presidente: {selectedChapa.presidente || '—'}</p></div>}
                    {selectedType === 'branco' && <div className="confirm-data"><strong style={{fontSize:26}}>VOTO EM BRANCO</strong></div>}
                    {selectedType === 'nulo' && <div className="confirm-data"><strong style={{fontSize:26}}>VOTO NULO</strong></div>}
                  </div>}

                  {step === 'fim' && <div className="fim"><div style={{fontSize:70}}>✓</div><h2>FIM</h2><p>Seu voto foi registrado.</p><button className="btn-reset" onClick={resetForNext}>VOLTAR AO INÍCIO</button></div>}

                  {message && <div className={`alert ${message.includes('registrado') ? 'success':''}`}>{message}</div>}
                </div>
              </div>
            </div>

            <div className="urna-keyboard">
              <div className="keypad-grid">
                {['1','2','3','4','5','6','7','8','9','','0',''].map((k,i) => k ? <button key={i} className="key" onClick={() => keyPress(k)} disabled={loading}>{k}</button> : <div key={i}></div>)}
              </div>
              <div className="keypad-grid">
                <button className="key action white" onClick={blank} disabled={loading || step !== 'vote'}>BRANCO</button>
                <button className="key action correct" onClick={clearAll} disabled={loading || (step !== 'ra' && step !== 'vote')}>CORRIGE</button>
                <button className="key action confirm" onClick={() => step === 'ra' ? findStudent() : step === 'confirm-student' ? confirmStudent() : step === 'vote' ? proceedVoteConfirm() : step === 'confirm-vote' ? registerVote() : undefined} disabled={loading || step === 'fim'}>CONFIRMA</button>
              </div>
              <div className="keyboard-label">Use o teclado para digitar. BRANCO não seleciona nenhuma chapa. CORRIGE apaga a etapa atual. CONFIRMA avança.</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
