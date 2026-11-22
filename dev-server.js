// Local preview only. GitHub Pages serves site/ directly.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("./site/", import.meta.url);
const types = {
  html: "text/html",
  css: "text/css",
  js: "text/javascript",
  svg: "image/svg+xml",
};
const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const file = new URL(
      "." + (pathname === "/" ? "/index.html" : pathname),
      root,
    );
    if (!fileURLToPath(file).startsWith(fileURLToPath(root))) throw Error();
    const bytes = await readFile(file);
    response.writeHead(200, {
      "Content-Type":
        types[file.pathname.split(".").pop()] || "application/octet-stream",
    });
    response.end(bytes);
  } catch {
    response.writeHead(404).end("File unavailable");
  }
});
server.listen(Number(process.env.PORT || 4173), "127.0.0.1", () =>
  console.log("DeadlineDrop at http://127.0.0.1:" + server.address().port),
);
