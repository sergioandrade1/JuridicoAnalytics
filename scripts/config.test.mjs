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
