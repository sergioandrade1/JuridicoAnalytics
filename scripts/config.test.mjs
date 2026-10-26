import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

test("index.html referencia app.js e style.css existentes", () => {
  const html = read("index.html");
  assert.match(html, /<script src="app\.js"/);
  assert.doesNotThrow(() => read("app.js"));
  assert.doesNotThrow(() => read("style.css"));
});

test("_headers exige revalidacao para os arquivos do app", () => {
  const h = read("_headers");
  for (const p of ["/index.html", "/app.js", "/style.css"])
    assert.ok(h.includes(p), p);
});

test("netlify publica a raiz sem build", () => {
  const t = read("netlify.toml");
  assert.match(t, /publish = "\."/);
});

test("app.js define showSendStatus (regressao: era chamada sem definicao)", () => {
  assert.match(read("app.js"), /function showSendStatus\(/);
});

test("fluxo nao injeta texto de categoria em atributo onclick (regressao XSS)", () => {
  assert.ok(!read("index.html").includes("finFluxoAbrirConta('${"));
  assert.match(read("index.html"), /data-conta="\$\{sanitize\(c\.codigo\)\}"/);
});

test("_headers cobre fin-core.js", () => {
  assert.ok(read("_headers").includes("/fin-core.js"));
});

test("jsArg gera argumento de onclick seguro (regressao: nome de advogado com aspas)", () => {
  const src = read("app.js");
  const fns = ["sanitize", "jsArg"].map(
    (n) => src.match(new RegExp(`function ${n}\\(.*`))[0],
  );
  const jsArg = new Function(`${fns.join("\n")}; return jsArg;`)();
  const decode = (s) =>
    s
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  for (const nome of [`D'Avila`, `x');alert(1);//`, `a"b<c>&`]) {
    const attr = jsArg(nome);
    assert.ok(!/["'<>]/.test(attr), attr);
    // o navegador decodifica o atributo e executa f(<arg>)
    assert.equal(new Function(`return ${decode(attr)};`)(), nome);
  }
  assert.ok(!src.includes(`openLawyerModal('\${`));
});
