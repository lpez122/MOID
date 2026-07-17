import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = fileURLToPath(new URL(".", import.meta.url));
const publicRoot = join(siteRoot, "public");
const imageRoot = resolve(siteRoot, "../images_finalized/done");
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function safePath(root, requestPath) {
  const resolved = resolve(root, `.${sep}${normalize(requestPath)}`);
  return resolved === root || resolved.startsWith(`${root}${sep}`) ? resolved : null;
}

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  let root = publicRoot;
  let requestPath = decodeURIComponent(url.pathname);

  if (requestPath.startsWith("/images/")) {
    root = imageRoot;
    requestPath = requestPath.slice("/images".length);
  } else if (requestPath === "/") {
    requestPath = "/index.html";
  }

  const file = safePath(root, requestPath);
  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[extname(file).toLowerCase()] || "application/octet-stream",
    "Cache-Control": requestPath.endsWith("catalog.json") ? "no-cache" : "public, max-age=3600"
  });
  createReadStream(file).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`MOID is live at http://127.0.0.1:${port}`);
});
