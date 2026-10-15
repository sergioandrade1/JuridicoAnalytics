# Setup e evidências

## Origem e contexto
- Data: 2026-10-15. Toolkit `soumatheusgomes/vibe-coding-toolkit`, revisão `f13bb35` (clone raso de `main`; atualidade verificada).
- Projeto: site estático (HTML/JS), Netlify. Cliente: Claude Code em sessão de nuvem efêmera, Superpowers ausente (protocolo de brainstorming seguido manualmente). Subagentes: não usados (escopo pequeno, execução direta).
- Escolha do usuário: opção "leve" (docs + harness + ferramentas de dev em `warn` + CI), sem refatorar o legado.

## Decisões e fontes
- Sem Next/Drizzle/TypeScript: não aplicáveis; stack preservada. ESLint 9 (flat config) em `app.js`; Prettier só nos arquivos novos de ferramenta.
- Context7 não consultado (sem acesso nesta sessão); usada a configuração conhecida do ESLint flat config. Limitação registrada.

## Componentes
| Componente | Ação e motivo | Escopo | Estado e evidência |
|---|---|---|---|
| AGENTS.md / CLAUDE.md | Criados a partir do template, adaptados | Projeto | Presentes; descoberta em nova sessão não observada |
| Docs (9 destinos) | Criados; `product.md` antigo inexistente | Projeto | Presentes |
| ESLint + Prettier | Instalados como devDependencies, regras em `warn` | Projeto | `npm run check` passa (0 erros, 34 avisos) |
| Testes | `node --test` de configuração + regressão | Projeto | 4/4 passam |
| Smoke Playwright | `playwright-core` + Chromium local | Projeto | Página carrega, título ok; `tailwind`/`firebase` indefinidos porque o sandbox bloqueia CDNs — fluxo real não validado |
| CI | GitHub Actions `check.yml` | Projeto | Não executada |
| Quality gates do toolkit (profile JS/TS) | Inaplicável: regras são para Next/TS/Drizzle | — | Substituído por ESLint nativo |
| Superpowers, Ponytail, Caveman, RTK, Context7, Graphify, Vercel skills, agent-browser/DevTools MCP, memória/Obsidian, skills de artefatos, hooks | Não instalados: são configurações de usuário/cliente e a sessão é efêmera | Usuário | Pendente: instalar na máquina local seguindo `docs/tools/` do toolkit |
| Vercel/Next skills | Inaplicável (sem React/Next; deploy Netlify) | — | — |

## Verificações
| Item | Estado | Evidência |
|---|---|---|
| Lint antes | 6 erros `no-undef` (`showSendStatus`), 4 `no-empty` | `eslint app.js` |
| Lint depois | 0 erros, 34 avisos (29 unused-vars, 4 no-empty, 1 max-lines) | `npm run lint` |
| Bug corrigido | `showSendStatus` definida; teste de regressão | `scripts/config.test.mjs` |
| Fluxo em navegador com login/CDN | Pendente | Rodar `npm run smoke` com rede liberada |
| Build / tipos | Inaplicável | Sem build |

## Manutenção
Repetir o setup: rodar o prompt 12 do toolkit; personalizações são preservadas. Revisitar: avisos de lint (reduzir), `max-lines` (extrair módulos de `index.html`), fixar versões de CDN, regras do Firestore.
