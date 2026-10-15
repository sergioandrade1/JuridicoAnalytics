# Arquitetura

- `index.html` (~2100 linhas): marcacao, Tailwind config e scripts inline (modulo financeiro `FIN`, protecoes de dominio/iframe, log de acesso local).
- `app.js` (~515 linhas compactadas): estado, Firebase Auth, importacao XLSX, filtros, graficos, prazos, e-mail. Define `firebaseConfig` e `switchTab`, usados pelo script inline financeiro.
- `style.css`: estilos complementares ao Tailwind.
- Dados: planilha importada em `localStorage` (`juridico_data_v10`); financeiro em Firestore.
- Deploy: Netlify (`publish="."`), cache `no-cache` em `_headers`.

## Riscos conhecidos
- Bibliotecas CDN sem versao fixa (`chart.js`, `@emailjs/browser@4`, `cdn.tailwindcss.com`).
- Protecao de dominio/iframe so no cliente: nao e controle de seguranca.
- `showSendStatus` e chamada em `app.js` e nao esta definida (envio de e-mail falha nesses ramos).
- Arquivos acima da referencia de 350 linhas.
