const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const esbuild = require("esbuild");
const puppeteer = require("puppeteer-core");

const root = path.resolve(__dirname, "..");
const scenes = require("../src/data/paintings.json");

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return candidate;
    } catch { /* try the next browser */ }
  }
  throw new Error("Chrome was not found. Set CHROME_PATH to its executable.");
}

async function main() {
  console.log("Bundling target compiler…");
  const bundle = await esbuild.build({
    entryPoints: [path.join(__dirname, "ar-target-compiler.js")],
    bundle: true,
    platform: "browser",
    format: "iife",
    write: false,
  });
  const compiler = bundle.outputFiles[0].contents;
  const allowedImages = new Map(scenes.map(({ svgFile }) => [svgFile, path.basename(svgFile)]));
  const server = http.createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (pathname === "/") {
      response.setHeader("Content-Type", "text/html");
      response.end('<!doctype html><script src="/compiler.js"></script>');
    } else if (pathname === "/compiler.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(compiler);
    } else if (allowedImages.has(pathname)) {
      response.setHeader("Content-Type", "image/svg+xml");
      response.end(await fs.readFile(path.join(root, "public", "images", allowedImages.get(pathname))));
    } else {
      response.statusCode = 404;
      response.end();
    }
  });

  let browser;
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    console.log("Opening local Chrome…");
    browser = await puppeteer.launch({
      executablePath: chromePath(),
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
    });
    const page = await browser.newPage();
    page.on("pageerror", (error) => console.error("Compiler page:", error));
    page.on("requestfailed", (request) => console.error("Compiler request:", request.url(), request.failure()));
    page.setDefaultTimeout(120000);
    console.log("Loading compiler page…");
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    console.log("Compiler page loaded; waiting for its API…");
    await page.waitForFunction(() => typeof window.compileTargets === "function", { timeout: 20000 });
    await fs.mkdir(path.join(root, "public", "ar-targets"), { recursive: true });

    console.log(`Compiling ${scenes.length} scenes into one image target library…`);
    const urls = scenes.map(({ svgFile }) => svgFile.split("/").map(encodeURIComponent).join("/"));
    const bytes = await page.evaluate((sources) => window.compileTargets(sources), urls);
    await fs.writeFile(path.join(root, "public", "ar-targets", "scenes.mind"), Buffer.from(bytes));
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
