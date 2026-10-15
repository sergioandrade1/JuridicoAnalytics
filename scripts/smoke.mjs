// Smoke test local: sobe o site em porta livre e confere que a pagina carrega.
// Requer rede para as bibliotecas de CDN. Uso: npm run smoke
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright-core";

const root = new URL("..", import.meta.url).pathname;
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
};
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
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
});
const errors = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const title = await page.title();
  console.log(`title: ${title}`);
  console.log(`erros de pagina: ${errors.length}`, errors);
  if (!title.includes("Juridico Analytics")) process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
