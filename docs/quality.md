# Qualidade

## Comandos
- `npm run lint`: ESLint (`app.js`, `scripts/`). Linha de base: ver `docs/setup.md`.
- `npm run format:check`: Prettier nos arquivos de ferramenta (nao reformata o legado).
- `npm test`: testes de configuracao do deploy.
- `npm run test:ui`: lançamento rápido, saldo, Fluxo de Caixa e Conta Garantida do financeiro em Chromium, com Firestore em memória (não toca produção; sem Tailwind, então não valida o visual).
- `npm run smoke`: abre o site em Chromium local (precisa de rede/CDN).
- `npm run check`: lint + formato + testes. CI: `.github/workflows/check.yml`.

## Regras de base
- Teto de 350 linhas (`max-lines`, em `warn` por causa do legado).
- Sem TypeScript/build: tipos e build nao se aplicam.
- Regras novas entram em `warn` com contagem e plano; nao suprimir em massa.

## Avisos de lint (2026-10-26)
16 avisos (antes 34): 7 `no-unused-vars` em `catch(e)`, 4 `no-empty` (catches vazios do legado), 1 `max-lines` (`app.js`, 523 linhas) e 4 candidatos a codigo morto em `app.js` (`isDark`, `openPrazoModal`, `openFluxoDetailModal`, `activeLawyerTab`). Os 18 falsos positivos de globais usados pelo HTML sairam pela diretiva `/* exported */`. Plano: remover os candidatos mortos apos conferir no navegador; trocar `catch(e){}` por `catch{}` quando a linha for tocada.

## Estrategia de testes
`npm test` cobre configuracao e a logica de `fin-core.js`; `npm run test:ui` cobre o financeiro com Firestore falso. Cobrir logica extraida do legado conforme for refatorada.

## Revisao de seguranca
Prompt reutilizavel em `docs/prompts/security-review.md` (fonte: toolkit, prompt 13, revisao registrada no topo do arquivo). Modo padrao: baseline do repositorio; para um diff, informe base e head. Somente leitura; relatorio privado fora do repositorio; nao corrige sozinho. `differential-review` nao instalado: usar rastreamento manual.

## Melhoria do harness (Harness2, adaptacao nativa)
Modo: adaptacao nativa do metodo (sem CLI oficial). Invocacao: prompt 15 do toolkit (`docs/prompts/15-harness-improvement.md`) com casos do prompt 14. Uma comparacao candidata so quando houver falha observada; sem falha, nada muda.

## Revisao apos implementacao
Sugerir 3 a 8 ciclos de code review (convencao do projeto), com focos complementares.
