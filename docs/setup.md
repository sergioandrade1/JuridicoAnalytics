# Setup e evidências

## Origem e contexto
- Atualização: 2026-10-26. Toolkit `soumatheusgomes/vibe-coding-toolkit`, revisão `790a895` (2026-10-18; clone de `main`, atualidade verificada). Setup anterior: 2026-10-15, revisão `f13bb35`. Mudanças relevantes desde então: guias 17–23, Harness2 como fluxo padrão, prompt de revisão de segurança, padronização em inglês.
- Projeto: site estático (HTML/JS), Netlify, Firebase via CDN. Cliente: Claude Code em sessão de nuvem efêmera. Superpowers ausente: protocolo de brainstorming seguido manualmente (uma pergunta de escopo; escolhido "atualizar leve", sem refatorar o legado).
- Delegação: subagentes só para trabalho isolável (revisão de segurança, caso de harness em contexto limpo, revisão do diff). Modelo leve para o caso de leitura; modelo da sessão para segurança e revisão. Cada um recebeu objetivo, escopo e formato de retorno; o coordenador conferiu os resultados.
- Context7: indisponível nesta sessão; nenhuma API nova foi adotada (só a diretiva `/* exported */` do ESLint, comportamento documentado e verificado pelo lint).

## Matriz de cobertura
| Componente | Necessidade | Decisão | Estado e evidência |
|---|---|---|---|
| AGENTS.md / CLAUDE.md | Instruções curtas | Atualizado (continuidade, revisão de segurança, globais `exported`) | Caso em contexto limpo: 5/5 respostas certas com fonte |
| 9 destinos do manifest | Docs canônicos | Reutilizados (já existem); `quality.md` e `setup.md` atualizados | Presentes, sem placeholders |
| ESLint + Prettier | Lint do legado | Reutilizados; falsos positivos de globais resolvidos sem afrouxar regra | 34 → 16 avisos, 0 erros |
| Quality gates do toolkit (perfil JS/TS) | — | Inaplicável: regras para Next/TS/Drizzle/logger | ESLint nativo |
| Lint tipado (no-floating-promises) | — | Inaplicável: sem TypeScript | — |
| Dependências | Atualização compatível | Já no topo da faixa compatível; ESLint 10 / globals 17 são major → não migrado | `npm outdated` |
| Testes / CI | Regressão | Reutilizados (`check.yml`) | `npm run check` e `test:ui` passam |
| Revisão de segurança (prompt 13) | Reutilizável | Copiado para `docs/prompts/security-review.md`; baseline executado | Ver seção Segurança |
| Harness2 | Melhoria medida | Adaptação nativa; sem falha observada, nenhuma instrução candidata | Ver `docs/quality.md` |
| Superpowers, Ponytail, Caveman, RTK, Context7, Graphify | Ferramentas do cliente | Bloqueado: são instalações de usuário/máquina; sessão efêmera | Instalar localmente via `docs/tools/` do toolkit |
| Graphify (grafo do projeto) | Baixa (3 arquivos de código) | Inaplicável por ora | Revisitar se o código for modularizado |
| Vercel skills / find-skills, next-dev-loop, next-bundle-optimizer | — | Inaplicável: sem React/Next, deploy Netlify | — |
| supabase-postgres-best-practices | — | Inaplicável: Firestore, sem PostgreSQL | — |
| gh-fix-ci | CI GitHub | Inaplicável: fluxo Codex; aqui o Claude usa o MCP do GitHub | — |
| differential-review | Diffs sensíveis | Não instalado (sessão efêmera); fallback manual registrado | Pendente na máquina local |
| shadcn | — | Inaplicável: Tailwind via CDN, sem shadcn | — |
| Sentry MCP | — | Não selecionado: sem conta/projeto Sentry | — |
| Navegador (agent-browser / DevTools MCP) | UI existe | Reutilizado: Playwright + Chromium local (`test:ui`, `smoke`) | `test:ui` passa; smoke bloqueado por CDN |
| Memória em camadas | Contexto durável | Reutilizado: `AGENTS.md` (índice) + `docs/*` sob demanda; sem vault externo | Carregado via `CLAUDE.md` → `@AGENTS.md` |
| Skills de artefatos, skill-creator, plugins, aia-harness | — | Não necessários agora | — |
| Hooks do cliente | — | Não adicionados (sem necessidade) | — |

## Verificações
| Item | Antes | Depois |
|---|---|---|
| `npm run check` | Passa (0 erros, 34 avisos, 20 testes) | Passa (0 erros, 16 avisos, 20 testes) |
| `npm run test:ui` | 3/3 OK | 3/3 OK |
| `npm run smoke` | Título ok; `tailwind`/`firebase` indefinidos (CDN bloqueado no sandbox) | Igual; fluxo real pendente |
| Build / tipos | Inaplicável | Inaplicável |
| Rerun | — | Sem seções, scripts ou configs duplicados |

## Segurança (baseline 2026-10-26, commit `c5a620c`)
Revisão estática, somente leitura, com `docs/prompts/security-review.md`; relatório completo privado, fora do repositório. Nada corrigido (correções pedem instrução separada). Achados:
1. Alta, **corrigido**: campos de lançamentos, parceiros e da importação iam para `innerHTML` sem escape no financeiro. Agora passam por `sanitize`; ids em `onclick` usam `jsArg`. Regressão: `npm run test:ui` ("dados do Firestore escapados"), que falhava antes da correção.
2. Média, **corrigido**: nome de advogado no `onclick` de `app.js` agora usa `jsArg`. Regressão: `npm test` ("jsArg gera argumento de onclick seguro").
3. Média: "lembrar-me" guarda a senha em base64 no `localStorage` (`app.js`, `saveCredentials`).
4. Média: scripts de CDN sem versão fixa/SRI; `_headers` sem CSP nem proteção contra frame.
5. Baixa (a validar): toasts renderizados como HTML.
Limites: regras reais do Firestore não estão no repo (testar no emulador); sem `npm audit` (envia o manifesto); sem mapeamento ASVS. Ausência de outros achados não prova segurança.

## Manutenção
Repetir o setup: rodar o prompt 12 do toolkit na revisão atual; personalizações preservadas. Atualizar o prompt de segurança copiando o bloco novo. Revisitar: candidatos a código morto (`docs/quality.md`), ESLint 10 (major), `max-lines` do `index.html`, fixar versões de CDN, regras do Firestore. Gatilhos: nova revisão do toolkit, mudança de stack, uso de PostgreSQL/Next.

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
As coleções `configFinanceiro` e `contaGarantida` precisam estar liberadas para usuários autenticados. Adicione aos blocos existentes, dentro de `match /databases/{database}/documents`, antes do bloco final `match /{document=**}`, usando as funções `podeFinanceiro()` que as regras já têm:

```
    match /configFinanceiro/{ano} {
      allow read: if podeFinanceiro();
      allow create, update: if podeFinanceiro()
        && (!('saldoInicial' in request.resource.data) || request.resource.data.saldoInicial is number)
        && (!('garantiaInicial' in request.resource.data) || request.resource.data.garantiaInicial is number);
      allow delete: if false;
    }

    // Um documento por dia: o id e a data (AAAA-MM-DD).
    match /contaGarantida/{dia} {
      allow read: if podeFinanceiro();
      allow create, update: if podeFinanceiro()
        && request.resource.data.data is string
        && request.resource.data.data == dia
        && request.resource.data.ano is int
        && request.resource.data.ano >= 2000
        && request.resource.data.ano <= 2100
        && request.resource.data.mes is int
        && request.resource.data.mes >= 1
        && request.resource.data.mes <= 12
        && request.resource.data.saldo is number;
      allow delete: if podeFinanceiro();
    }
```

Nada foi publicado nas regras (a validação do importador em lotes respeita o `exists()` do parceiro nas regras de `lancamentos`); é uma alteração do console do Firebase, feita por você.

## Ordem sugerida de entrada em produção
1. Liberar as duas coleções nas regras.
2. Fazer o merge do PR e esperar o deploy do Netlify.
3. Importar a Conta Garantida (aba Importar planilha).
4. Preencher o saldo inicial do ano em Lançamentos e conferir o Fluxo de Caixa contra a planilha (jan e fev devem bater).
