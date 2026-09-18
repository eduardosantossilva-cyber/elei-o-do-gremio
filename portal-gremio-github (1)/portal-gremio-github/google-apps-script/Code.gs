/**
 * PORTAL DO GRÊMIO — API GOOGLE SHEETS
 *
 * COMO USAR
 * 1. Abra a planilha que será a base da eleição.
 * 2. Extensões > Apps Script.
 * 3. Cole este arquivo inteiro em Code.gs.
 * 4. Execute setup() uma vez.
 * 5. Em Configurações do projeto > Propriedades do script, crie:
 *      ADMIN_PASSWORD = a mesma senha definida no Vercel.
 * 6. Implante como Aplicativo da Web:
 *      Executar como: Eu
 *      Quem tem acesso: Qualquer pessoa
 * 7. Copie a URL /exec para GOOGLE_SHEETS_API_URL no Vercel.
 *
 * Abas criadas:
 *   Config, Alunos, Chapas, Votos
 *
 * Alunos:
 *   RA | Nome | DataNascimento | JaVotou
 * Chapas:
 *   Numero | Nome | Presidente | Vice | Slogan | Foto
 * Votos:
 *   Timestamp | Urna | ChapaNumero | Tipo | RAHash
 */

const SHEETS = {
  CONFIG: 'Config',
  ALUNOS: 'Alunos',
  CHAPAS: 'Chapas',
  VOTOS: 'Votos',
};

function setup() {
  const ss = getSS_();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  ensureSheet_(ss, SHEETS.CONFIG, ['Chave', 'Valor']);
  ensureSheet_(ss, SHEETS.ALUNOS, ['RA', 'Nome', 'DataNascimento', 'JaVotou']);
  ensureSheet_(ss, SHEETS.CHAPAS, ['Numero', 'Nome', 'Presidente', 'Vice', 'Slogan', 'Foto']);
  ensureSheet_(ss, SHEETS.VOTOS, ['Timestamp', 'Urna', 'ChapaNumero', 'Tipo', 'RAHash']);

  const config = ss.getSheetByName(SHEETS.CONFIG);
  const values = config.getDataRange().getValues();
  const keys = values.slice(1).map(r => String(r[0]).trim());
  const defaults = [
    ['status', 'FECHADA'],
    ['titulo', 'Eleição do Grêmio Estudantil'],
    ['escola', 'E.E. Professor Antônio Rosas da Silva Galvão'],
  ];
  defaults.forEach(([key, value]) => {
    if (!keys.includes(key)) config.appendRow([key, value]);
  });
  SpreadsheetApp.flush();
  return { ok: true, message: 'Estrutura criada.' };
}

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'status');
    const p = (e && e.parameter) || {};
    return json_(route_(action, p));
  } catch (err) {
    return json_({ ok: false, message: errorMessage_(err) });
  }
}

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const p = JSON.parse(raw);
    const action = String(p.action || '');
    return json_(route_(action, p));
  } catch (err) {
    return json_({ ok: false, message: errorMessage_(err) });
  }
}

function route_(action, p) {
  setup();
  switch (action) {
    case 'status': return getStatus_();
    case 'student': return getStudent_(String(p.ra || ''));
    case 'chapas': return getChapas_();
    case 'vote': return registerVote_(p);
    case 'stats': return adminStats_(p);
    case 'save_chapa': return saveChapa_(p);
    case 'delete_chapa': return deleteChapa_(p);
    case 'set_status': return setStatus_(p);
    default: return { ok: false, message: 'Ação não reconhecida.' };
  }
}

function getStatus_() {
  const config = getConfig_();
  return { ok: true, status: String(config.status || 'FECHADA').toUpperCase(), titulo: config.titulo || '', escola: config.escola || '' };
}

function getStudent_(ra) {
  const normalized = normalizeRA_(ra);
  if (!normalized) return { ok: false, message: 'Informe o RA.' };
  const sh = getSS_().getSheetByName(SHEETS.ALUNOS);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const [rowRA, nome, nascimento, jaVotou] = rows[i];
    if (normalizeRA_(rowRA) === normalized) {
      return {
        ok: true,
        student: {
          ra: String(rowRA),
          nome: String(nome || ''),
          nascimento: formatDate_(nascimento),
          jaVotou: String(jaVotou || '').toUpperCase() === 'SIM',
        },
      };
    }
  }
  return { ok: false, message: 'RA não localizado na lista de eleitores.' };
}

function getChapas_() {
  const sh = getSS_().getSheetByName(SHEETS.CHAPAS);
  const rows = sh.getDataRange().getValues();
  const chapas = [];
  for (let i = 1; i < rows.length; i++) {
    const [numero, nome, presidente, vice, slogan, foto] = rows[i];
    if (!String(numero).trim()) continue;
    chapas.push({
      numero: String(numero).trim(),
      nome: String(nome || '').trim(),
      presidente: String(presidente || '').trim(),
      vice: String(vice || '').trim(),
      slogan: String(slogan || '').trim(),
      foto: String(foto || '').trim(),
    });
  }
  chapas.sort((a,b) => a.numero.localeCompare(b.numero, 'pt-BR', {numeric:true}));
  return { ok: true, chapas };
}

function registerVote_(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const config = getConfig_();
    if (String(config.status || '').toUpperCase() !== 'ABERTA') return { ok: false, message: 'A votação está encerrada.' };

    const ra = normalizeRA_(p.ra);
    const tipo = String(p.tipo || '').toLowerCase();
    const urna = String(p.urna || '01').slice(0, 20);
    const chapaNumero = String(p.chapaNumero || '').trim();
    if (!ra) return { ok:false, message:'RA inválido.' };
    if (!['chapa','branco','nulo'].includes(tipo)) return { ok:false, message:'Tipo de voto inválido.' };

    const alunos = getSS_().getSheetByName(SHEETS.ALUNOS);
    const rows = alunos.getDataRange().getValues();
    let studentRow = -1;
    let currentVoted = false;
    for (let i = 1; i < rows.length; i++) {
      if (normalizeRA_(rows[i][0]) === ra) {
        studentRow = i + 1;
        currentVoted = String(rows[i][3] || '').toUpperCase() === 'SIM';
        break;
      }
    }
    if (studentRow === -1) return { ok:false, message:'RA não localizado.' };
    if (currentVoted) return { ok:false, message:'Este RA já possui um voto registrado.' };

    if (tipo === 'chapa') {
      const chapas = getChapas_().chapas;
      if (!chapas.some(c => c.numero === chapaNumero)) return { ok:false, message:'Chapa não cadastrada.' };
    }

    const hash = sha256Hex_(ra);
    const votos = getSS_().getSheetByName(SHEETS.VOTOS);
    votos.appendRow([new Date(), urna, chapaNumero, tipo.toUpperCase(), hash]);
    alunos.getRange(studentRow, 4).setValue('SIM');
    SpreadsheetApp.flush();
    return { ok:true, message:'Voto registrado com sucesso.' };
  } finally {
    lock.releaseLock();
  }
}

function adminStats_(p) {
  requireAdmin_(p);
  const ss = getSS_();
  const config = getConfig_();
  const alunos = ss.getSheetByName(SHEETS.ALUNOS).getDataRange().getValues();
  const votos = ss.getSheetByName(SHEETS.VOTOS).getDataRange().getValues();
  const chapas = getChapas_().chapas;

  const totalEleitores = Math.max(0, alunos.length - 1);
  let votaram = 0;
  for (let i=1; i<alunos.length; i++) if (String(alunos[i][3] || '').toUpperCase() === 'SIM') votaram++;

  const counts = {};
  chapas.forEach(c => counts[c.numero] = 0);
  let brancos = 0, nulos = 0;
  for (let i=1; i<votos.length; i++) {
    const tipo = String(votos[i][3] || '').toUpperCase();
    const numero = String(votos[i][2] || '').trim();
    if (tipo === 'CHAPA' && counts.hasOwnProperty(numero)) counts[numero]++;
    else if (tipo === 'BRANCO') brancos++;
    else if (tipo === 'NULO') nulos++;
  }

  const porChapa = chapas.map(c => ({ numero:c.numero, nome:c.nome, votos:counts[c.numero] || 0 }));
  const totalVotos = brancos + nulos + porChapa.reduce((s,x)=>s+x.votos,0);
  return {
    ok:true,
    status:String(config.status || 'FECHADA').toUpperCase(),
    titulo:config.titulo || '', escola:config.escola || '',
    totalEleitores, votaram, faltam:Math.max(0,totalEleitores-votaram), totalVotos,
    brancos, nulos, porChapa,
  };
}

function saveChapa_(p) {
  requireAdmin_(p);
  const numero = String(p.numero || '').replace(/\D/g,'').slice(0,3);
  const nome = String(p.nome || '').trim();
  if (!numero || !nome) return { ok:false, message:'Número e nome da chapa são obrigatórios.' };
  const sh = getSS_().getSheetByName(SHEETS.CHAPAS);
  const rows = sh.getDataRange().getValues();
  for (let i=1; i<rows.length; i++) {
    if (String(rows[i][0]).trim() === numero) {
      sh.getRange(i+1,1,1,6).setValues([[numero,nome,String(p.presidente||''),String(p.vice||''),String(p.slogan||''),String(p.foto||'')]]);
      return {ok:true, message:'Chapa atualizada.'};
    }
  }
  sh.appendRow([numero,nome,String(p.presidente||''),String(p.vice||''),String(p.slogan||''),String(p.foto||'')]);
  return {ok:true, message:'Chapa cadastrada.'};
}

function deleteChapa_(p) {
  requireAdmin_(p);
  const numero = String(p.numero || '').trim();
  const sh = getSS_().getSheetByName(SHEETS.CHAPAS);
  const rows = sh.getDataRange().getValues();
  for (let i=1; i<rows.length; i++) {
    if (String(rows[i][0]).trim() === numero) { sh.deleteRow(i+1); return {ok:true, message:'Chapa removida.'}; }
  }
  return {ok:false, message:'Chapa não encontrada.'};
}

function setStatus_(p) {
  requireAdmin_(p);
  const status = String(p.status || '').toUpperCase();
  if (!['ABERTA','FECHADA'].includes(status)) return {ok:false,message:'Status inválido.'};
  const sh = getSS_().getSheetByName(SHEETS.CONFIG);
  const rows = sh.getDataRange().getValues();
  for (let i=1; i<rows.length; i++) {
    if (String(rows[i][0]).trim() === 'status') { sh.getRange(i+1,2).setValue(status); return {ok:true,status}; }
  }
  sh.appendRow(['status',status]);
  return {ok:true,status};
}

function requireAdmin_(p) {
  const props = PropertiesService.getScriptProperties();
  const expected = String(props.getProperty('ADMIN_PASSWORD') || '');
  if (!expected) throw new Error('Defina ADMIN_PASSWORD nas propriedades do script.');
  if (String(p.password || '') !== expected) throw new Error('Senha administrativa inválida.');
}

function getConfig_() {
  const sh = getSS_().getSheetByName(SHEETS.CONFIG);
  const rows = sh.getDataRange().getValues();
  const cfg = {};
  for (let i=1; i<rows.length; i++) cfg[String(rows[i][0]).trim()] = rows[i][1];
  return cfg;
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  else {
    const existing = sh.getRange(1,1,1,headers.length).getValues()[0];
    let missing = false;
    for (let i=0; i<headers.length; i++) if (String(existing[i]||'') !== headers[i]) missing=true;
    if (missing) sh.getRange(1,1,1,headers.length).setValues([headers]);
  }
  sh.setFrozenRows(1);
}

function normalizeRA_(value) { return String(value == null ? '' : value).trim().replace(/\s+/g,''); }

function formatDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  const s = String(value || '').trim();
  return s;
}

function sha256Hex_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


function getSS_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function errorMessage_(err) { return err && err.message ? err.message : String(err); }
