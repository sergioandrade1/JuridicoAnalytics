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
