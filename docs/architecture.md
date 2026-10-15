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
Guardado em `configFinanceiro/{ano}` no Firestore. Se as regras ainda não liberam essa coleção, a tela avisa e usa o valor do navegador.
Saldo corrente: só Entrada soma e Saída subtrai (Repasse, Despesa Conta PF, Recebimento Repasse e Espécie não movem o saldo).

## Financeiro: Fluxo de Caixa
Aba "Fluxo de Caixa": conta × mês calculado de `finFluxoMensal`. Casa a conta pelo código (texto antes de " - "); cada linha soma só os tipos que a planilha soma (1.01–1.03 Entrada; 1.04 Espécie; 2.* Saída e Recebimento Repasse). Contas fora do plano ou tipos incompatíveis (ex.: vazio, Despesa Conta PF) aparecem em "Fora do plano / tipo incompatível", fora dos totais. O saldo corrente da lista só move com Entrada e Saída, como na planilha. Clique numa célula abre Lançamentos filtrado por conta e mês.

## Financeiro: Conta Garantida
Coleção `contaGarantida` (um registro por dia: data, ano, mes, saldo, obs) e `garantiaInicial` em `configFinanceiro/{ano}`. Salvar na mesma data corrige o registro. Redução do mês = saldo do mês anterior − saldo do mês (só quando os dois meses têm registro); o saldo do mês alimenta a linha "Saldo pendente conta garantida" do Fluxo. **As regras do Firestore precisam liberar `configFinanceiro` e `contaGarantida`.**
