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

## Financeiro (planilha Fluxo de Caixa 2026)
Entregas feitas após o harness: lançamento rápido com plano de contas real, saldo corrente, aba Fluxo de Caixa (conta × mês, drill-down, exportação) e Conta Garantida. Regras de cálculo conferidas contra a planilha real (jan e fev batem em entradas e saídas); detalhes em `docs/architecture.md`.

| Item | Estado | Evidência |
|---|---|---|
| Lógica (`fin-core.js`) | Validado | `npm test` (17+ testes), comparação com valores reais |
| Interface com Firestore falso | Validado | `npm run test:ui` |
| Firestore real e regras (`configFinanceiro`, `contaGarantida`) | Pendente | Liberar as coleções nas regras e testar com login real |
| Visual com Tailwind real | Pendente | Conferir as abas após o deploy |
| Mês pela data vs. pela aba da planilha | Decidido: vale a data do lançamento | O importador já avisa as 156 linhas com data fora da aba; o Painel pode diferir da planilha nesses meses |
| Espécie | Decidido: não move o saldo nem entra nos totais de entrada | Igual à planilha (1.04 fica separado) |
| Importar a Conta Garantida (180 registros) | Pronto | Aba Importar planilha; idempotente (id = data); conferido mês a mês com a planilha |

## Regras do Firestore (sugestão, não aplicada)
As coleções `configFinanceiro` e `contaGarantida` precisam estar liberadas para usuários autenticados. Adicione aos blocos existentes, adaptando ao padrão que as regras atuais já usam para `lancamentos` e `parceiros`:

```
match /configFinanceiro/{ano} { allow read, write: if request.auth != null; }
match /contaGarantida/{dia}   { allow read, write: if request.auth != null; }
```

Nada foi publicado nas regras; é uma alteração do console do Firebase, feita por você.

## Ordem sugerida de entrada em produção
1. Liberar as duas coleções nas regras.
2. Fazer o merge do PR e esperar o deploy do Netlify.
3. Importar a Conta Garantida (aba Importar planilha).
4. Preencher o saldo inicial do ano em Lançamentos e conferir o Fluxo de Caixa contra a planilha (jan e fev devem bater).
