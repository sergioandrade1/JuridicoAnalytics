// Teste de interface do modulo financeiro com Firebase/CDNs falsos (sem rede e
// sem tocar no Firestore real). Uso: npm run test:ui
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const root = fileURLToPath(new URL("..", import.meta.url));
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
};

// Firestore em memoria, com a parte da API que o modulo usa.
const FAKE_FIREBASE = `
(function () {
  const store = { parceiros: {}, lancamentos: {}, configFinanceiro: {}, contaGarantida: {} };
  let n = 0;
  const snap = (col) => ({ docs: Object.entries(store[col]).map(([id, d]) => ({ id, data: () => d })) });
  const doc = (col, id) => ({
    get: async () => ({ exists: id in store[col], data: () => store[col][id] }),
    set: async (d, o) => { store[col][id] = Object.assign(o && o.merge ? store[col][id] || {} : {}, d); },
    update: async (d) => { Object.assign(store[col][id], d); },
    delete: async () => { delete store[col][id]; },
  });
  const collection = (col) => ({
    get: async () => snap(col),
    where: (f, op, v) => ({ get: async () => ({ docs: snap(col).docs.filter((x) => x.data()[f] === v) }) }),
    add: async (d) => { const id = 'id' + (++n); store[col][id] = d; return { id }; },
    doc: (id) => doc(col, id || 'id' + (++n)),
  });
  const user = { email: 'teste@local' };
  const auth = { currentUser: user, onAuthStateChanged: (cb) => cb(user), signOut: async () => {} };
  const db = {
    collection,
    batch: () => {
      const ops = [];
      return {
        set: (ref, d, o) => ops.push([ref, d, o]),
        delete: (ref) => ops.push([ref, null, 'del']),
        update: (ref, d) => ops.push([ref, d, 'upd']),
        commit: async () => { for (const [r, d, o] of ops) await (o === 'del' ? r.delete() : o === 'upd' ? r.update(d) : r.set(d, o)); },
      };
    },
  };
  window.__store = store;
  window.firebase = {
    apps: [], initializeApp() { this.apps.push(1); },
    auth: () => auth,
    firestore: Object.assign(() => db, { FieldValue: { serverTimestamp: () => 'ts' } }),
  };
})();`;

const server = createServer(async (req, res) => {
  const path = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, {
      "Content-Type": types[extname(path)] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ??
    (existsSync("/opt/pw-browsers/chromium")
      ? "/opt/pw-browsers/chromium"
      : undefined),
});
const erros = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1400, height: 1000 },
  });
  page.on("pageerror", (e) => erros.push(e.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const u = route.request().url();
    const js = u.includes("firebase-app")
      ? FAKE_FIREBASE
      : u.includes("tailwind")
        ? "window.tailwind={};"
        : "";
    route.fulfill({
      contentType: u.endsWith(".css") ? "text/css" : "text/javascript",
      body: js,
    });
  });
  await page.goto(base, { waitUntil: "load" });
  await page.evaluate(() => {
    document
      .querySelectorAll("#tab-fin-lancamentos")
      .forEach((e) => e.classList.remove("hidden"));
    finOnTab("fin-lancamentos");
  });
  await page.waitForTimeout(300);

  // saldo inicial 0,33 como na planilha
  await page.fill("#fin-saldo-inicial", "0.33");
  await page.press("#fin-saldo-inicial", "Tab");

  // 1) Entrada: escolher a conta define o tipo
  await page.fill("#fin-lanc-data", "2026-01-02");
  await page.fill("#fin-lanc-valor", "11000");
  await page.fill("#fin-lanc-descricao", "Dislub");
  await page.selectOption(
    "#fin-lanc-categoria",
    "1.01.04 - Honorários - Mensal",
  );
  assert.equal(await page.inputValue("#fin-lanc-tipo"), "Entrada");
  assert.ok(
    await page
      .locator("#fin-lanc-parceiro-box")
      .evaluate((e) => e.classList.contains("hidden")),
  );
  await page.press("#fin-lanc-descricao", "Enter"); // Enter salva
  await page.waitForTimeout(300);

  // data mantida, foco no movimento, formulario limpo
  assert.equal(await page.inputValue("#fin-lanc-data"), "2026-01-02");
  assert.equal(await page.inputValue("#fin-lanc-valor"), "");

  // 2) Saida de uma conta administrativa
  await page.fill("#fin-lanc-valor", "3.12");
  await page.fill("#fin-lanc-descricao", "Tarifa Boleto");
  await page.selectOption(
    "#fin-lanc-categoria",
    "2.05.003 - Tarifas Bancárias",
  );
  assert.equal(await page.inputValue("#fin-lanc-tipo"), "Saída");
  await page.press("#fin-lanc-valor", "Enter");
  await page.waitForTimeout(300);

  // 3) Conta de parceria mostra o campo parceiro
  await page.selectOption(
    "#fin-lanc-categoria",
    "2.02.001 - Parceria Jurídica",
  );
  assert.ok(
    !(await page
      .locator("#fin-lanc-parceiro-box")
      .evaluate((e) => e.classList.contains("hidden"))),
  );

  // A aba abre no mes atual (sem janeiro); o chip Jan mostra os lancamentos.
  assert.equal(await page.locator("#fin-meses-bar button").count(), 13);
  assert.equal(
    await page
      .locator("#fin-lanc-body tr")
      .filter({ hasText: "Dislub" })
      .count(),
    0,
  );
  await page.locator("#fin-meses-bar button", { hasText: /^Jan$/ }).click();

  const linhas = await page.locator("#fin-lanc-body tr").allInnerTexts();
  const saldos = linhas.map((l) =>
    l.split("\t").filter(Boolean).slice(-1)[0].trim(),
  );
  console.log(linhas.length, "linhas; saldos:", saldos);
  assert.equal(linhas.length, 2);
  const resumo = await page.locator("#fin-lanc-resumo").innerText();
  assert.match(resumo, /11\.000,00/);
  assert.match(resumo, /10\.997,21/); // 0,33 + 11000 - 3,12
  const gravado = await page.evaluate(() =>
    Object.values(window.__store.lancamentos).map((l) => [l.tipo, l.valor]),
  );
  assert.deepEqual(gravado, [
    ["Entrada", 11000],
    ["Saída", 3.12],
  ]);
  assert.equal(
    await page.evaluate(
      () => window.__store.configFinanceiro["2026"]?.saldoInicial,
    ),
    0.33,
  );
  // 4) Fluxo de Caixa Mensal: totais, grupo aberto e drill-down por celula
  await page.evaluate(() => finRenderFluxo());
  const fluxo = await page.locator("#fin-fluxo-body").innerText();
  assert.match(fluxo, /Saldo inicial/);
  assert.match(fluxo, /Saldo final[\s\S]*10\.997,21/);
  await page.evaluate(() => finFluxoToggleTudo());
  const aberto = await page.locator("#fin-fluxo-body").innerText();
  assert.match(aberto, /1\.01\.04 - Honorários - Mensal/);
  assert.match(aberto, /2\.05\.003 - Tarifas Bancárias/);
  await page.locator('#fin-fluxo-body a:has-text("11.000,00")').first().click();
  await page.waitForTimeout(200);
  assert.equal(await page.inputValue("#fin-filtro-conta"), "1.01.04");
  assert.equal(await page.inputValue("#fin-filtro-mes"), "1");
  const filtradas = await page.locator("#fin-lanc-body tr").count();
  assert.equal(filtradas, 1);
  console.log("OK: fluxo de caixa e drill-down");

  // 5) Conta Garantida: devedor inicial, saldo do dia com Enter, variacao e Fluxo
  await page.fill("#fin-gar-inicial", "177329.82");
  await page.press("#fin-gar-inicial", "Tab");
  await page.fill("#fin-gar-data", "2026-01-02");
  await page.fill("#fin-gar-saldo", "178704.82");
  await page.press("#fin-gar-saldo", "Enter");
  await page.waitForTimeout(300);
  await page.fill("#fin-gar-saldo", "267564.82");
  await page.press("#fin-gar-saldo", "Enter"); // mesma data: corrige, nao duplica
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#fin-gar-body tr").count(), 1);
  assert.match(await page.locator("#fin-gar-atual").innerText(), /267\.564,82/);
  assert.match(await page.locator("#fin-gar-body").innerText(), /90\.235,00/); // variacao sobre o inicial
  assert.match(await page.locator("#fin-gar-meses").innerText(), /267\.564,82/);
  await page.evaluate(() => finRenderFluxo());
  assert.match(
    await page.locator("#fin-fluxo-body").innerText(),
    /Saldo pendente conta garantida[\s\S]*267\.564,82/,
  );
  assert.equal(
    await page.evaluate(
      () => window.__store.configFinanceiro["2026"].saldoInicial,
    ),
    0.33,
  ); // merge preserva
  console.log("OK: conta garantida");

  // 6) Conta fora do plano: drill-down filtra de verdade; filtros podem ser limpos
  await page.evaluate(() => {
    window.__store.lancamentos.fora1 = {
      data: "2026-03-01",
      ano: 2026,
      mes: 3,
      tipo: "Saída",
      valor: 10,
      categoria: "9.99.999 - Antiga",
      descricao: "x",
    };
    window.__store.lancamentos.rr1 = {
      data: "2026-03-02",
      ano: 2026,
      mes: 3,
      tipo: "Recebimento Repasse",
      valor: 5,
      categoria: "2.02.001 - Parceria Jurídica",
      descricao: "rr",
    };
    return finLoadAno();
  });
  // fecha e reabre todos os grupos para incluir o grupo "Fora do plano", novo
  await page.evaluate(() => {
    finFluxoToggleTudo();
    finFluxoToggleTudo();
  });
  await page
    .locator('#fin-fluxo-body a[data-conta="9.99.999"]')
    .first()
    .click();
  await page.waitForTimeout(200);
  assert.equal(await page.inputValue("#fin-filtro-conta"), "9.99.999");
  assert.equal(await page.locator("#fin-lanc-body tr").count(), 1);
  assert.ok(
    !(await page
      .locator("#fin-limpar-filtros")
      .evaluate((e) => e.classList.contains("hidden"))),
  );
  await page.evaluate(() => finLimparFiltros());
  // limpar filtros mantem o mes aberto; "Ano todo" mostra tudo
  assert.equal(await page.locator("#fin-lanc-body tr").count(), 2);
  await page.locator("#fin-meses-bar button", { hasText: "Ano todo" }).click();
  assert.equal(await page.locator("#fin-lanc-body tr").count(), 4);

  // 7) Editar e trocar a conta nao sobrescreve o tipo ja gravado
  await page.evaluate(() => finEditLancamento("rr1"));
  await page.selectOption("#fin-lanc-categoria", "2.01.008 - Energia Elétrica");
  assert.equal(await page.inputValue("#fin-lanc-tipo"), "Recebimento Repasse");
  console.log("OK: fora do plano, filtros e edicao");

  // 8) Conta garantida: id = data (mesma data nunca duplica)
  assert.deepEqual(
    await page.evaluate(() => Object.keys(window.__store.contaGarantida)),
    ["2026-01-02"],
  );

  // 8b) Mesmo arquivo da importacao: a previa da Conta Garantida aparece sozinha
  const resultado = await page.evaluate(() => {
    window.XLSX = { utils: { sheet_to_json: (ws) => ws.rows } };
    const linhas = [
      ["Saldo Devedor Inicial (informado)", 100],
      ["Data", "Mês", "Saldo do Dia (R$)"],
      ["02/01/2026", "JANEIRO", 150],
      ["03/01/2026", "JANEIRO", 120],
    ];
    const card = () =>
      !document.getElementById("fin-gar-import").classList.contains("hidden");
    finGarImportPreparar({
      SheetNames: ["Lançamentos Janeiro", "Controle Conta Garantida"],
      Sheets: { "Controle Conta Garantida": { rows: linhas } },
    });
    const com = {
      visivel: card(),
      texto: document.getElementById("fin-gar-import-resumo").innerText,
      pronto: !!FIN.garImport,
    };
    finGarImportPreparar({ SheetNames: ["Lançamentos Janeiro"], Sheets: {} });
    return { com, semAba: { visivel: card(), pronto: !!FIN.garImport } };
  });
  assert.ok(resultado.com.visivel && resultado.com.pronto);
  assert.match(resultado.com.texto, /2 registros/);
  assert.deepEqual(resultado.semAba, { visivel: false, pronto: false });
  console.log("OK: Conta Garantida pelo mesmo arquivo");

  // 8c) Saldo inicial do ano lido da aba "Fluxo de Caixa Mensal" (Janeiro)
  const saldoLido = await page.evaluate(() => {
    const wb = (rows) => ({
      SheetNames: ["Fluxo de Caixa Mensal"],
      Sheets: { "Fluxo de Caixa Mensal": { rows } },
    });
    return [
      finImportSaldoInicial(
        wb([
          ["Grupos de Contas", "Janeiro", "Fevereiro"],
          ["SALDO INICIAL", 0.33, 20006.87],
        ]),
      ),
      finImportSaldoInicial({
        SheetNames: ["Lançamentos Janeiro"],
        Sheets: {},
      }),
    ];
  });
  assert.deepEqual(saldoLido, [0.33, null]);
  console.log("OK: saldo inicial lido da planilha");

  // 8d) Mesmo dia segue a ordem da planilha; "Aplicar ordem" acerta os ja gravados
  const ordens = await page.evaluate(async () => {
    window.confirm = () => true;
    const s = window.__store.lancamentos;
    Object.keys(s).forEach((k) => delete s[k]);
    const base = { ano: 2026, mes: 3, data: "2026-03-10", tipo: "Saída" };
    const cat = "2.05.003 - Tarifas Bancárias";
    s.o1 = { ...base, valor: 1, categoria: cat, descricao: "B" };
    s.o2 = { ...base, valor: 2, categoria: cat, descricao: "A" };
    s.o3 = { ...base, valor: 3, categoria: cat, descricao: "C" };
    FIN.ano = 2026;
    await finLoadAno();
    FIN.importBuffer = {
      linhas: ["A", "B", "C"].map((m, i) => ({
        ordem: i,
        data: "2026-03-10",
        valor: i === 0 ? 2 : i === 1 ? 1 : 3,
        movimento: m,
        categoria: cat,
      })),
    };
    document
      .getElementById("fin-import-resumo")
      .insertAdjacentHTML("beforeend", '<div id="fin-import-ordem"></div>');
    await finImportAplicarOrdem();
    return FIN.lancamentos.map((l) => l.descricao).join("");
  });
  assert.equal(ordens, "ABC");
  console.log("OK: ordem da planilha no mesmo dia");

  // 8c) Conciliacao: clicar no nome mostra os lancamentos dele, inclusive das grafias fundidas
  const det = await page.evaluate(() => {
    const cat = FIN_CATEGORIAS_PARCERIA[0];
    const linha = (data, movimento, valor) => ({
      data,
      movimento,
      categoria: cat,
      valor,
      aba: "Lançamentos Janeiro",
    });
    const linhas = [
      linha("2026-01-05", "Mariana Leal", 100),
      linha("2026-01-03", "Mariana Leal HCP", 50),
      linha("2026-01-04", "Bruna Aquino", 70),
    ];
    const grupos = finImportGrupos(linhas);
    const chave = (nome) =>
      Object.keys(grupos).find((k) => grupos[k].rotulo === nome);
    FIN.vinculo = { linhas, grupos, sugestoes: [], fusoes: {} };
    finFundirCom(chave("Mariana Leal HCP"), chave("Mariana Leal"));
    const qtd = () => document.querySelectorAll(".fin-import-det").length;
    const botao = () =>
      [...document.querySelectorAll(".fin-import-nome")].find((b) =>
        b.textContent.includes("Mariana Leal"),
      );
    const fechado = qtd();
    botao().click();
    const aberto = [...document.querySelectorAll(".fin-import-det")].map(
      (tr) => tr.children[1].textContent,
    );
    finFundirCom(chave("Bruna Aquino"), ""); // re-render mantem aberto
    const aposRender = qtd();
    botao().click();
    return { fechado, aberto, aposRender, fechadoDeNovo: qtd() };
  });
  assert.equal(det.fechado, 0);
  assert.deepEqual(det.aberto, ["Mariana Leal HCP", "Mariana Leal"]);
  assert.equal(det.aposRender, 2);
  assert.equal(det.fechadoDeNovo, 0);
  console.log("OK: conciliacao mostra os lancamentos de cada nome");

  // 8d) Import grava TUDO sem parceiro; o Painel avisa e o vinculo e feito la
  page.on("dialog", (d) => d.accept());
  const imp = await page.evaluate(async () => {
    const col = window.__store.lancamentos;
    Object.keys(col).forEach((k) => delete col[k]);
    const cat = FIN_CATEGORIAS_PARCERIA[0];
    const mk = (data, movimento, categoria, valor) => ({
      aba: "Lançamentos Janeiro",
      mesAba: 1,
      alerta: null,
      data,
      ano: 2026,
      mes: 1,
      tipo: "Saída",
      movimento,
      categoria,
      valor,
    });
    FIN.importBuffer = {
      linhas: [
        mk("2026-01-05", "Mariana Leal", cat, 100),
        mk("2026-01-06", "Mariana Leal HCP", cat, 50),
        mk("2026-01-07", "Ricardo Oliveira (tapete)", "2.01.003 - Aluguel", 30),
      ],
      ignoradas: [],
      abasLidas: [],
      abasIgnoradas: [],
    };
    finImportRender();
    const semDecisao = document.querySelectorAll(
      "#fin-import-confirmar .fin-map",
    ).length;
    await finImportGravar();
    const docs = Object.values(col);
    return {
      semDecisao,
      total: docs.length,
      comParceiro: docs.filter((d) => d.parceiroId).length,
      aviso: document.getElementById("fin-painel-pendentes").textContent,
    };
  });
  assert.equal(imp.semDecisao, 0);
  assert.equal(imp.total, 3);
  assert.equal(imp.comParceiro, 0);
  assert.match(imp.aviso, /2 lançamento/);
  console.log("OK: import grava tudo sem parceiro e o Painel avisa");

  const vinc = await page.evaluate(async () => {
    const col = window.__store.lancamentos;
    finAbrirVinculo();
    const nomes = [
      ...document.querySelectorAll("#fin-vinculo .fin-import-nome"),
    ].map((b) => b.textContent.trim());
    await finVinculoGravar();
    const docs = Object.values(col);
    return {
      nomes,
      parceiros: [
        ...new Set(docs.filter((d) => d.parceiroId).map((d) => d.parceiroId)),
      ].length,
      vinculados: docs.filter((d) => d.parceiroId).length,
      tapete: docs.find((d) => /tapete/.test(d.descricao)).parceiroId,
      avisoOculto: document
        .getElementById("fin-painel-pendentes")
        .classList.contains("hidden"),
    };
  });
  assert.equal(vinc.nomes.length, 1); // grafias juntas; o tapete nem aparece
  assert.equal(vinc.parceiros, 1);
  assert.equal(vinc.vinculados, 2);
  assert.equal(vinc.tapete, null);
  assert.equal(vinc.avisoOculto, true);
  console.log(
    "OK: vinculo no Painel junta grafias e deixa o resto sem parceiro",
  );

  // 8b) Remover import: apaga so os lancamentos do lote, manual fica
  const lote = await page.evaluate(async () => {
    const col = window.__store.lancamentos;
    col.a1 = {
      data: "2026-01-05",
      ano: 2026,
      mes: 1,
      valor: 10,
      importId: "imp_1",
    };
    col.a2 = {
      data: "2026-01-06",
      ano: 2026,
      mes: 1,
      valor: 20,
      importId: "imp_1",
    };
    col.m1 = { data: "2026-01-07", ano: 2026, mes: 1, valor: 30 };
    await finLoadAno();
    const antes = document
      .getElementById("fin-import-lotes")
      .textContent.includes("imp_1");
    await finRemoverLote("imp_1");
    return {
      antes,
      restam: Object.keys(col).filter(
        (k) => k === "a1" || k === "a2" || k === "m1",
      ),
    };
  });
  assert.equal(lote.antes, true);
  assert.deepEqual(lote.restam, ["m1"]);
  console.log("OK: remover import apaga so o lote");

  // 9) Importar Conta Garantida: grava com id = data e rodar de novo nao duplica
  const regs = [
    { data: "2026-01-02", ano: 2026, mes: 1, saldo: 178704.82, obs: "" },
    { data: "2026-04-10", ano: 2026, mes: 4, saldo: 324279.25, obs: "" },
  ];
  for (let i = 0; i < 2; i++) {
    await page.evaluate((r) => {
      FIN.garImport = { registros: r, inicial: 177329.82, ignoradas: [] };
      return finGarImportGravar();
    }, regs);
  }
  assert.deepEqual(
    await page.evaluate(() =>
      Object.keys(window.__store.contaGarantida).sort(),
    ),
    ["2026-01-02", "2026-04-10"],
  );
  assert.equal(
    await page.evaluate(
      () => window.__store.configFinanceiro["2026"].garantiaInicial,
    ),
    177329.82,
  );
  assert.equal(
    await page.evaluate(
      () => window.__store.configFinanceiro["2026"].saldoInicial,
    ),
    0.33,
  );
  console.log("OK: importacao da conta garantida");

  // Regressao XSS: nomes, tipos e ids vindos do Firestore nao viram HTML/JS.
  const evil = '<img src=x onerror="window.__xss=1">';
  const xssRes = await page.evaluate(async (evil) => {
    window.__store.parceiros["p'x"] = { nome: evil, limite: 100, ativo: true };
    window.__store.lancamentos["l'x"] = {
      data: "2026-01-05",
      ano: 2026,
      mes: 1,
      valor: 500,
      tipo: evil,
      categoria: evil,
      descricao: evil,
      parceiroId: "p'x",
    };
    await finLoadAno(2026);
    ["fin-painel", "fin-lancamentos", "fin-parceiros"].forEach((t) =>
      finOnTab(t),
    );
    await new Promise((r) => setTimeout(r, 300));
    const chamados = [];
    window.finEditParceiro = (id) => chamados.push(id);
    window.finEditLancamento = (id) => chamados.push(id);
    document.querySelector('#fin-parc-body button[title="Editar"]')?.click();
    [...document.querySelectorAll("#fin-lanc-body button")][0]?.click();
    return {
      imgs: document.querySelectorAll('img[src="x"]').length,
      xss: window.__xss,
      chamados,
    };
  }, evil);
  assert.equal(xssRes.imgs, 0);
  assert.equal(xssRes.xss, undefined);
  assert.ok(xssRes.chamados.includes("p'x"), JSON.stringify(xssRes));
  console.log("OK: dados do Firestore escapados no HTML");

  await page.screenshot({ path: process.env.SHOT ?? "/tmp/fin-lanc.png" });
  const relevantes = erros.filter(
    (e) => !/tailwind|Chart|XLSX|emailjs/.test(e),
  );
  assert.deepEqual(relevantes, []);
  console.log("OK: fluxo de lancamento rapido");
} finally {
  await browser.close();
  server.close();
}
