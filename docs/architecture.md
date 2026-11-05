# Arquitetura

- `index.html` (~2100 linhas): marcacao, Tailwind config e scripts inline (modulo financeiro `FIN`, protecoes de dominio/iframe, log de acesso local).
- `app.js` (~515 linhas compactadas): estado, Firebase Auth, importacao XLSX, filtros, graficos, prazos, e-mail. Define `firebaseConfig` e `switchTab`, usados pelo script inline financeiro.
- `fin-core.js`: regras puras do financeiro (plano de contas real, tipo pela conta, sinal, saldo corrente Fluxo de Caixa Mensal e Conta Garantida), testadas em Node. Para mudar uma conta, edite `FIN_PLANO`.
- `style.css`: estilos complementares ao Tailwind.
- Dados: planilha importada em `localStorage` (`juridico_data_v10`); financeiro em Firestore.
- Deploy: Netlify (`publish="."`), cache `no-cache` em `_headers`.

## Riscos conhecidos
- Bibliotecas CDN sem versao fixa (`chart.js`, `@emailjs/browser@4`, `cdn.tailwindcss.com`).
- Protecao de dominio/iframe so no cliente: nao e controle de seguranca.
- `showSendStatus` e chamada em `app.js` e nao esta definida (envio de e-mail falha nesses ramos).
- Arquivos acima da referencia de 350 linhas.

## Financeiro: saldo inicial
Guardado em `configFinanceiro/{ano}` no Firestore. Na aba Importar planilha, o saldo inicial é lido da aba "Fluxo de Caixa Mensal" (linha SALDO INICIAL, coluna Janeiro; `finImportSaldoInicial`) e o botão "Usar como saldo inicial" grava no ano dos lançamentos. Se as regras ainda não liberam essa coleção, a tela avisa (Lançamentos e Fluxo) e os saldos partem de zero; nada é guardado no navegador, para todos os usuários verem o mesmo número.
Saldo corrente: só Entrada soma e Saída subtrai (Repasse, Despesa Conta PF, Recebimento Repasse e Espécie não movem o saldo).

## Financeiro: Fluxo de Caixa
Aba "Lançamentos": todos os lançamentos do ano num só lugar, aberta por mês como as abas da planilha. Uma barra de meses (Jan–Dez e "Ano todo") troca o mês; abre no mês atual (`finMesPadrao`). O resumo do topo é do mês aberto (entradas, saídas e saldo no fim do mês, já contando os meses anteriores). A tabela mostra 200 linhas por vez (`FIN_LANC_PAGINA`, botão "Ver mais") para não pesar.

Aba "Fluxo de Caixa": conta × mês calculado de `finFluxoMensal`. Casa a conta pelo código (texto antes de " - "); cada linha soma só os tipos que a planilha soma (1.01–1.03 Entrada; 1.04 Espécie; 2.* Saída e Recebimento Repasse). Contas fora do plano ou tipos incompatíveis (ex.: vazio, Despesa Conta PF) aparecem em "Fora do plano / tipo incompatível", fora dos totais. O saldo corrente da lista só move com Entrada e Saída, como na planilha. Clique numa célula abre Lançamentos filtrado por conta e mês.

## Financeiro: Conta Garantida
Coleção `contaGarantida` (um registro por dia: data, ano, mes, saldo, obs) e `garantiaInicial` em `configFinanceiro/{ano}`. O id do documento é a data (AAAA-MM-DD): salvar na mesma data corrige o registro, mesmo entre usuários. Redução do mês = saldo do mês anterior − saldo do mês (só quando os dois meses têm registro); o saldo do mês alimenta a linha "Saldo pendente conta garantida" do Fluxo. **As regras do Firestore precisam liberar `configFinanceiro` e `contaGarantida`.**

## Financeiro: importação e vínculo de parceiros
Cada tela resolve a sua parte, de forma independente. A aba Importar planilha só confere e grava: **todas** as linhas entram em `lancamentos` com `parceiroId: null`, sem pedir decisão de nome, e alimentam o Fluxo de Caixa e a aba Lançamentos.

Os lançamentos de Parceria Jurídica (2.02.001) e Honorários Fixos (2.02.002) sem parceiro ficam **aguardando vínculo**: o Painel de Parcerias mostra um aviso com a quantidade e o valor, e o botão "Vincular parceiros" abre a conciliação (`finAbrirVinculo`, buffer `FIN.vinculo`) sobre esses lançamentos do ano carregado. Lá cada nome pode ser aberto (clique) para listar seus lançamentos, já com as fusões aplicadas (`finMapaFusao`). Para várias grafias no mesmo nome, use "juntar em"; as caixinhas de sugestão aceitam um destino por nome. Ao confirmar (`finVinculoGravar`), cria os parceiros novos e atualiza `parceiroId`/`parceiroNome` em lotes. Só entram na distribuição os lançamentos já vinculados. Lançamentos de outras categorias nunca precisam de parceiro.

**As regras do Firestore precisam aceitar `lancamentos` de parceria com `parceiroId` nulo (import) e `update` de `parceiroId`/`parceiroNome` (vínculo).** As regras não estão no repositório; confira no console do Firebase antes de usar em produção.

As decisões de fusão (juntar em / caixinhas) ficam em `localStorage` (`fin-fusoes-v1`) e são reaplicadas nos próximos vínculos; "não fundir" também é lembrado.

Após gravar, a aba Importar planilha lista os imports do ano carregado (`importId`) com "Remover import" (`finRemoverLote`): apaga só os lançamentos do lote, em batches de 400; parceiros criados no import permanecem. Depende de as regras do Firestore permitirem `delete` em `lancamentos`.
