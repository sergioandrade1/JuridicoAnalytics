# Qualidade

## Comandos
- `npm run lint`: ESLint (`app.js`, `scripts/`). Linha de base: ver `docs/setup.md`.
- `npm run format:check`: Prettier nos arquivos de ferramenta (nao reformata o legado).
- `npm test`: testes de configuracao do deploy.
- `npm run test:ui`: lançamento rápido do financeiro em Chromium, com Firestore em memória (não toca produção; sem Tailwind, então não valida o visual).
- `npm run smoke`: abre o site em Chromium local (precisa de rede/CDN).
- `npm run check`: lint + formato + testes. CI: `.github/workflows/check.yml`.

## Regras de base
- Teto de 350 linhas (`max-lines`, em `warn` por causa do legado).
- Sem TypeScript/build: tipos e build nao se aplicam.
- Regras novas entram em `warn` com contagem e plano; nao suprimir em massa.

## Estrategia de testes
Cobrir logica extraida do legado conforme for refatorada; hoje ha apenas testes de configuracao e smoke de carga.

## Revisao apos implementacao
Sugerir 3 a 8 ciclos de code review (convencao do projeto), com focos complementares.
