# Juridico Analytics

## Produto e stack

- Produto e escopo: `PRODUCT.md`. Arquitetura: `docs/architecture.md`.
- Stack: site estatico em HTML/JS puro, sem build. Tailwind, Chart.js, SheetJS, Firebase (auth + Firestore) e EmailJS vem de CDN. Deploy Netlify (`netlify.toml`, `_headers`).
- Node/npm servem apenas para ferramentas de desenvolvimento (`package.json`); nao entram no deploy.

## Comandos canonicos

- Instalar: `npm install`
- Desenvolver: `npm run dev` (http://localhost:8080; o dominio `localhost` e permitido pelo index)
- Lint: `npm run lint` (ESLint em `app.js`, `fin-core.js` e `scripts/`)
- Formato: `npm run format:check`
- Testes: `npm test` (config do deploy e referencias)
- Teste de interface do financeiro: `npm run test:ui` (Firebase e CDNs falsos, sem rede)
- Smoke no navegador: `npm run smoke` (precisa de rede para os CDNs e de Chromium)
- Tipos / build: indisponiveis (sem TypeScript, sem build)
- Verificar base: `npm run check`

## Acordos de trabalho

- Leia o codigo e as instrucoes antes de editar; separe observacao, hipotese e evidencia.
- Menor mudanca suficiente; reutilize o que existe. Sem dependencias ou abstracoes nao pedidas.
- Defina o aceite antes; correcao de bug ganha reproducao e teste de regressao quando viavel.
- Nao enfraqueca validacao, testes ou regras para passar checks. Regra nova com legado comeca em `warn`.
- Publicar, push para main, custos e acoes destrutivas exigem autorizacao especifica.
- Segredos nunca no repositorio. A `apiKey` do Firebase web e publica por desenho; a seguranca depende das regras do Firestore/Auth.
- Atualize o documento responsavel (`PRODUCT.md`, `docs/*`) junto de mudancas de comportamento, comandos ou configuracao.
- Bloqueio parcial afeta so o que depende dele; continue o resto autorizado. Ao retomar trabalho, confira checkout, arquivos e checks antes de confiar em anotacoes.
- Revisao de seguranca: `docs/prompts/security-review.md` (somente leitura, relatorio privado fora do repo).
- Apos cada ciclo de implementacao ou correcao, sugira 3 a 8 ciclos de code review (convencao do projeto), com motivo e prompt copiavel.

## Convenções

- `app.js` e legado compactado em poucas linhas longas; ao mexer, prefira extrair trechos pequenos e legiveis em vez de ampliar linhas.
- Globais de `app.js` chamados por `onclick` do `index.html` ficam na diretiva `/* exported */` do topo; inclua ali ao criar um novo.
- `index.html` concentra marcacao e scripts inline (painel financeiro depende de `firebaseConfig` de `app.js`; `app.js` carrega primeiro).
- Os cabecalhos de cache ficam em `_headers`, nao em `netlify.toml`.
