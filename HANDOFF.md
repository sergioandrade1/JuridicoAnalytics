# Handoff — Módulo Financeiro / Controladoria (Jurídico Analytics)

Contexto para continuar o trabalho em outra sessão.

## O projeto
SPA single-file (`index.html`, ~119 KB, 1802 linhas): vanilla JS + Tailwind CDN
+ Chart.js + SheetJS + Firebase (compat SDK 10.12.2). Sem build, sem backend.
As abas antigas (processos/advogados) continuam em localStorage e paleta indigo.
O módulo financeiro novo usa Firestore e paleta vinho #960018 / dourado #D4AF37
/ vinho escuro #4A0404, escopada em `.fin-*` para não vazar no resto.

- Repo: sergioandrade1/JuridicoAnalytics
- Branch de trabalho: `claude/painel-parcerias-financeiro-luc1ic`
- Commits: `641f1e2` (módulo) e `4e8a8c8` (firebaseConfig preenchido)
- Arquivos: `index.html`, `firestore.rules`

## Round 1 — ENTREGUE (código pronto, na branch)
1. Firebase Auth real (e-mail/senha) no lugar da senha fixa `DEMO_PASS`.
   Botão extra "Entrar apenas no Financeiro" dispensa upload de planilha.
2. `firestore.rules` — só autenticado; valida enum de tipo, ano 2000-2100,
   mês 1-12, valor > 0 e `parceiroId` existente em /parceiros.
3. CRUD de parceiros (nome único via nomeNorm, limiteMensal, ativo) com
   bloqueio de exclusão quando há lançamento vinculado.
4. CRUD de lançamentos: parceiro/tipo/categoria por dropdown, valor sempre
   positivo, alerta de estouro de limite ANTES de salvar.
5. Painel de Parcerias: parceiros x Jan-Dez (distribuído/disponível), coluna
   do parceiro sticky, linha TOTAL, filtro por ano, vermelho no estouro,
   export XLSX.
6. Importação do Fluxo de Caixa com tela de conciliação (cada "Movimento"
   distinto vira um dropdown: parceiro existente / criar novo / sem parceiro),
   gravação em lotes de 400 com `importId`.

## Modelo de dados (Firestore)
`parceiros`: nome, nomeNorm, ativo:bool, limiteMensal:50000, criadoEm/Por
`lancamentos`: data(string aaaa-mm-dd), ano:int, mes:int, valor:number>0,
  descricao, parceiroId(FK|null), parceiroNome(denormalizado, só exibição),
  tipo(enum), categoria(enum), origem("manual"|"import"), importId

Decisão: `valor` SEMPRE POSITIVO — a direção do dinheiro vem do `tipo`.

## REGRA DO PAINEL (crítica — não alterar sem pedido explícito)
Distribuído(parceiro, mês) = SOMA de `valor` onde:
  parceiroId = parceiro
  E categoria IN ("2.02.001 - Parceria Jurídica", "2.02.002 - Honorários Fixos")
  E tipo IN ("Repasse", "Saída", "Despesa Conta PF")
IGNORA tipo vazio e IGNORA "Recebimento Repasse" (regra de perna única: o
repasse conta uma vez só, na saída de quem intermediou).
Disponível = limiteMensal − Distribuído. Distribuído > limite => vermelho.

Implementado em `finCalcPainel()`. Testado em harness Node: 8 casos passando,
incluindo os 4 que a planilha errava (tipo vazio, recebimento duplicando,
categoria fora do par, lançamento sem parceiro).

## Estado da infraestrutura (Firebase "juridico-analytics")
- [x] Projeto criado, plano Spark (sem cartão — não pode gerar cobrança)
- [x] App web "Painel Web" + firebaseConfig já colado no index.html
- [x] Authentication e-mail/senha ativo, 2 usuários (sergioandradejr00@...,
      elaide.souza@...) criados em março
- [x] Firestore criado: `(default)`, southamerica-east1 (São Paulo), produção
- [x] Regras publicadas no console
- [ ] TESTE PENDENTE: cadastrar um parceiro pelo app e ver gravar

## PRÓXIMO PASSO (é só isso)
Servir a pasta (`py -m http.server 8000`) e abrir http://localhost:8000 —
NÃO abrir como file://, o Firebase Auth recusa o domínio. Login, aba
Parceiros, cadastrar um de teste.

Erros possíveis e causa:
- "Missing or insufficient permissions" -> regras não publicadas
- "The database (default) does not exist" -> Firestore não criado
- "unauthorized domain" -> abriu como file:// ou domínio novo sem autorizar
  em Authentication > Configurações > Domínios autorizados
- Índice faltando -> o erro no console (F12) traz link que cria com 1 clique

## Perfil do usuário (importante)
Sérgio não é desenvolvedor. Zero experiência com Firebase e pouca com
terminal. Precisa de instrução explícita: onde clicar, onde colar, em qual
janela. Já se perdeu no console confundindo SQL Connect e Realtime Database
com Firestore. Preocupação declarada: medo de cobrança inesperada (resolvida:
Spark não tem cartão). Não mandar comando sem dizer onde executar.

## Fora do escopo deste round (rounds seguintes)
DRE, fluxo de caixa consolidado, conta garantida. Não implementar sem pedido.

## Pendências conhecidas
- Migração ainda não rodada: falta importar Fluxo_de_Caixa_2026.xlsx. O parser
  não foi calibrado nas abas reais (ninguém viu o arquivo ainda) — conferir
  se o cabeçalho Data|Tipo|Movimento|Categoria|Valor|Saldo é detectado.
- Importação não tem desfazer no app. Cada lote grava `importId`, então dá
  para apagar pelo console. Foi oferecido um botão "desfazer última
  importação" para round futuro — não implementado.
- Hospedagem não definida. Recomendado Firebase Hosting (domínio já autorizado
  no Auth, mesmo console); Netlify como alternativa. Vercel foi desaconselhado
  porque o plano grátis é para uso não-comercial e aqui é ferramenta de
  escritório. Nada disso muda o código.
