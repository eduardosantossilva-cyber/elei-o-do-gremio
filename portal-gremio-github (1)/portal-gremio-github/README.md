# Portal do Grêmio Estudantil

Site com duas áreas:

- `/urna` — urna eletrônica para os alunos.
- `/admin` — painel da comissão eleitoral.

O sistema usa **Google Sheets como banco de dados**, através de uma Web App do Google Apps Script. O site pode ser publicado no Vercel e várias urnas podem acessar o mesmo site ao mesmo tempo.

## Fluxo da urna

1. Aluno informa o RA.
2. O site consulta a planilha e mostra nome e data de nascimento.
3. Aluno confirma os próprios dados.
4. A urna abre a tela de voto.
5. Aluno digita o número da chapa.
6. Aparecem nome, integrantes, slogan e foto (quando cadastrada).
7. Aluno confirma.
8. O voto é registrado no Google Sheets.
9. A tela mostra **FIM**.
10. O botão **VOLTAR AO INÍCIO** aparece somente depois do FIM, permitindo o próximo aluno.

## Google Sheets / Apps Script

Abra a planilha do Drive que será usada na eleição e vá em **Extensões > Apps Script**.

Cole `google-apps-script/Code.gs` inteiro em `Code.gs` e execute `setup()` uma vez.

O script cria quatro abas:

### Alunos

| RA | Nome | DataNascimento | JaVotou |
|---|---|---|---|
| 123456 | João da Silva | 10/05/2012 | |

Preencha esta aba com a lista real dos eleitores. A coluna `JaVotou` pode ficar vazia antes da eleição.

### Chapas

| Numero | Nome | Presidente | Vice | Slogan | Foto |
|---|---|---|---|---|---|
| 10 | Voz Estudantil | Ana | Pedro | Participação e diálogo | https://... |

A foto deve ser uma URL pública que possa ser exibida no navegador. O próprio painel administrativo também cadastra/edita essas informações.

### Votos

É preenchida automaticamente pelo sistema. O RA não é salvo em texto puro: é armazenado como hash SHA-256.

### Config

O `setup()` cria:

- `status` = FECHADA
- `titulo` = Eleição do Grêmio Estudantil
- `escola` = E.E. Professor Antônio Rosas da Silva Galvão

Você pode alterar os valores diretamente na aba `Config`.

## Senha administrativa

No Apps Script, vá em **Configurações do projeto > Propriedades do script** e crie:

`ADMIN_PASSWORD = sua-senha`

Use a mesma senha na variável de ambiente do Vercel:

`ADMIN_PASSWORD=...`

## Publicar o Apps Script

1. Clique em **Implantar > Nova implantação**.
2. Tipo: **Aplicativo da Web**.
3. Executar como: **Eu**.
4. Quem tem acesso: **Qualquer pessoa**.
5. Copie a URL que termina em `/exec`.

## Vercel

No projeto do Vercel, configure:

`GOOGLE_SHEETS_API_URL=https://script.google.com/macros/s/SEU_ID/exec`

`ADMIN_PASSWORD=sua-senha`

Depois, faça o deploy do projeto Next.js.

## GitHub

Depois de extrair o projeto:

```bash
git init
git add .
git commit -m "Sistema de eleição do Grêmio Estudantil"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```

## Várias urnas

Cada computador abre o mesmo site e pode usar um identificador diferente:

```text
https://SEU-SITE.vercel.app/urna?urna=01
https://SEU-SITE.vercel.app/urna?urna=02
https://SEU-SITE.vercel.app/urna?urna=03
https://SEU-SITE.vercel.app/urna?urna=04
```

O identificador da urna vai para a planilha junto do voto, mas todos os votos são centralizados no mesmo banco.

## Observações importantes

- A coluna `JaVotou` é alterada junto com o registro do voto usando `LockService`, reduzindo o risco de dois computadores registrarem dois votos para o mesmo RA ao mesmo tempo.
- O painel administrativo atualiza os números aproximadamente a cada 4 segundos.
- O sistema não possui ainda uma rotina pública de auditoria nem assinatura digital de votos.
- Antes de uma eleição real, faça testes com dados fictícios, confira a lista de eleitores, a política de retenção dos dados e o acesso à planilha.
