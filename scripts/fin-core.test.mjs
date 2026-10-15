import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const { FIN_CONTAS, FIN_PLANO, finTipoDaConta, finSinal, finCalcSaldos } =
  createRequire(import.meta.url)("../fin-core.js");

test("plano de contas tem as 86 contas e codigos unicos", () => {
  assert.equal(FIN_CONTAS.length, 86);
  const codigos = FIN_CONTAS.map((c) => c.split(" - ")[0]);
  assert.equal(new Set(codigos).size, codigos.length);
  assert.ok(FIN_PLANO.every((g) => g.contas.length > 0));
});

test("tipo vem do codigo da conta", () => {
  assert.equal(finTipoDaConta("1.01.04 - Honorários - Mensal"), "Entrada");
  assert.equal(finTipoDaConta("2.05.003 - Tarifas Bancárias"), "Saída");
  assert.equal(finTipoDaConta("3.01.001 - Outra"), null);
  assert.equal(finTipoDaConta(""), null);
});

test("sinal do saldo por tipo", () => {
  assert.equal(finSinal("Entrada"), 1);
  assert.equal(finSinal("Saída"), -1);
  assert.equal(finSinal("Repasse"), -1);
  assert.equal(finSinal("Espécie"), 0);
  assert.equal(finSinal(""), 0);
});

test("saldo corrente reproduz a formula da planilha (janeiro)", () => {
  // Valores reais das primeiras linhas: saldo inicial 0,33.
  const l = [
    { id: "a", data: "2026-01-02", tipo: "Entrada", valor: 11000 },
    { id: "b", data: "2026-01-02", tipo: "Entrada", valor: 2277 },
    { id: "c", data: "2026-01-02", tipo: "Saída", valor: 3.12 },
  ];
  const r = finCalcSaldos(l, 0.33);
  assert.equal(r.saldos.a, 11000.33);
  assert.equal(r.saldos.c, 13274.21);
  assert.equal(r.entradas, 13277);
  assert.equal(r.saidas, 3.12);
  assert.equal(r.saldoFinal, 13274.21);
});

test("ordena por data sem perder a ordem do mesmo dia", () => {
  const l = [
    { id: "x", data: "2026-02-01", tipo: "Saída", valor: 10 },
    { id: "y", data: "2026-01-31", tipo: "Entrada", valor: 100 },
  ];
  const r = finCalcSaldos(l, 0);
  assert.deepEqual(
    r.ordem.map((i) => i.id),
    ["y", "x"],
  );
  assert.equal(r.saldos.x, 90);
});

test("fluxo mensal: saldo encadeia os meses e agrupa por codigo da conta", () => {
  const { finFluxoMensal } = createRequire(import.meta.url)("../fin-core.js");
  const l = [
    {
      mes: 1,
      tipo: "Entrada",
      valor: 1000,
      categoria: "1.01.04 - Honorários - Mensal",
    },
    {
      mes: 1,
      tipo: "Saída",
      valor: 200,
      categoria: "2.01.008 - Energia Elétrica",
    },
    // texto diferente do plano, mesmo codigo: deve cair na mesma linha
    { mes: 2, tipo: "Saída", valor: 50, categoria: "2.01.008 -  Energia" },
    { mes: 2, tipo: "Saída", valor: 10, categoria: "9.99.999 - Conta antiga" },
  ];
  const r = finFluxoMensal(l, 100);
  assert.equal(r.resumo[0].saldoInicial, 100);
  assert.equal(r.resumo[0].resultado, 800);
  assert.equal(r.resumo[0].saldoFinal, 900);
  assert.equal(r.resumo[1].saldoInicial, 900);
  assert.equal(r.resumo[1].saidas, 60);
  assert.equal(r.resumo[11].saldoFinal, 840);
  const energia = r.grupos
    .flatMap((g) => g.contas)
    .find((c) => c.codigo === "2.01.008");
  assert.deepEqual(
    [energia.valores[0], energia.valores[1], energia.total],
    [200, 50, 250],
  );
  const fora = r.grupos.find((g) => g.grupo === "Fora do plano");
  assert.equal(fora.total[1], 10);
});

test("fluxo mensal ignora mes invalido sem quebrar", () => {
  const { finFluxoMensal } = createRequire(import.meta.url)("../fin-core.js");
  const r = finFluxoMensal(
    [{ mes: 13, tipo: "Entrada", valor: 5, categoria: "1.01.04 - X" }],
    0,
  );
  assert.equal(r.resumo[11].saldoFinal, 0);
});

test("conta garantida: variacao, saldo do mes e reducao como na planilha", () => {
  const { finGarantiaResumo } = createRequire(import.meta.url)(
    "../fin-core.js",
  );
  // Valores reais de janeiro: devedor inicial 177.329,82.
  const r = [
    { id: "a", data: "2026-01-02", mes: 1, saldo: 178704.82 },
    { id: "b", data: "2026-01-05", mes: 1, saldo: 267564.82 },
    { id: "c", data: "2026-02-03", mes: 2, saldo: 260000 },
  ];
  const g = finGarantiaResumo(r, 177329.82);
  assert.equal(g.variacoes.a, 1375);
  assert.equal(g.variacoes.b, 88860);
  assert.equal(g.meses[0].saldoFinal, 267564.82);
  assert.equal(g.meses[0].reducao, -90235); // dívida subiu
  assert.equal(g.meses[1].reducao, 7564.82);
  assert.equal(g.meses[2].saldoFinal, null);
  assert.equal(g.atual, 260000);
});

test("conta garantida sem registros usa o devedor inicial", () => {
  const { finGarantiaResumo } = createRequire(import.meta.url)(
    "../fin-core.js",
  );
  const g = finGarantiaResumo([], 500);
  assert.equal(g.atual, 500);
  assert.equal(g.meses[0].reducao, null);
});
