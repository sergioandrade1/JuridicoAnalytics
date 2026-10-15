# Produto

**Juridico Analytics** — painel de gestao administrativa para escritorio juridico: importa planilhas (Excel) de processos, mostra indicadores e graficos, controla prazos e compromissos (peso 1-5 definido pela gerencia), envia relatorios por e-mail e tem painel financeiro (lancamentos, conciliacao e Painel de Parcerias).

## Observado no codigo
- Login com Firebase Auth, logout por inatividade (30 min), dados em `localStorage` e Firestore (financeiro).
- Importacao de planilhas via SheetJS; graficos via Chart.js; e-mail via EmailJS.
- Acesso restrito ao dominio `juridicoanalytics.netlify.app` (e localhost) por checagem no navegador.

## Fora do escopo desta documentacao
Requisitos nao observados no codigo (publico, metas, SLAs) nao foram inventados. Complete aqui quando houver.
