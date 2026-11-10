const { chromium } = require("playwright");
const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const { once } = require("node:events");
const { join } = require("node:path");

const siteFiles = new Map([
  ["/index.html", "text/html; charset=utf-8"],
  ["/assets/styles.css", "text/css; charset=utf-8"],
  ["/assets/museums.js", "text/javascript; charset=utf-8"],
  ["/assets/wishlist.js", "text/javascript; charset=utf-8"],
  ["/assets/app.js", "text/javascript; charset=utf-8"]
]);

async function openMuseumSite(t) {
  const server = createServer(async (request, response) => {
    const contentType = siteFiles.get(request.url);
    if (!contentType) return response.writeHead(404).end();

    try {
      const content = await readFile(join(__dirname, "..", request.url));
      response.writeHead(200, { "Content-Type": contentType }).end(content);
    } catch {
      response.writeHead(500).end();
    }
  });
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;

  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  // Fonts, photos, and the map CDN are outside the wishlist flow.
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    return route.abort();
  });
  return { page, url: `${origin}/index.html` };
}

module.exports = { openMuseumSite };
