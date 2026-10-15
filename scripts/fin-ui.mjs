// Teste de interface do modulo financeiro com Firebase/CDNs falsos (sem rede e
// sem tocar no Firestore real). Uso: npm run test:ui
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const root = new URL("..", import.meta.url).pathname;
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
  const db = { collection, batch: () => ({ set() {}, commit: async () => {} }) };
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
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
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
