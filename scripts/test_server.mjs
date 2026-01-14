#!/usr/bin/env node
// @ts-check

import fs from "fs/promises";
import http from "http";
import path from "path";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function sendJson(res, status, payload, headers = {}){
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(payload));
}

function makeEtag(){
  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `W/"${token}"`;
}

function getOrCreateSpace(spaces, spaceId){
  if(spaces.has(spaceId)) return spaces.get(spaceId);
  const space = { items: new Map() };
  spaces.set(spaceId, space);
  return space;
}

function handleSyncApi(req, res, spaces){
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const spaceId = url.searchParams.get("spaceId") || "default";
  const space = getOrCreateSpace(spaces, spaceId);
  const pathname = url.pathname;

  if(pathname === "/api/sync/v1/create" && req.method === "POST"){
    return sendJson(res, 200, { spaceId: `space-${Date.now()}`, authToken: `token-${Date.now()}` });
  }

  if(pathname === "/api/sync/v1/index" && req.method === "GET"){
    const items = Array.from(space.items.entries()).map(([key, value]) => ({
      key,
      hlc: value.payload?.hlc || "",
      etag: value.etag || ""
    }));
    return sendJson(res, 200, { items }, { ETag: makeEtag() });
  }

  if(pathname.startsWith("/api/sync/v1/item/")){
    const key = decodeURIComponent(pathname.slice("/api/sync/v1/item/".length));
    if(req.method === "GET"){
      const item = space.items.get(key);
      if(!item){
        return sendJson(res, 404, { error: "not_found" });
      }
      return sendJson(res, 200, item.payload, { ETag: item.etag || makeEtag() });
    }
    if(req.method === "PUT"){
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        const ifMatch = req.headers["if-match"] || "";
        const existing = space.items.get(key);
        if(existing && ifMatch && ifMatch !== "*" && ifMatch !== existing.etag){
          return sendJson(res, 412, { error: "precondition" }, { ETag: existing.etag || "" });
        }
        const payload = body ? JSON.parse(body) : null;
        const etag = makeEtag();
        space.items.set(key, { payload, etag });
        return sendJson(res, 200, { ok: true }, { ETag: etag });
      });
      return;
    }
  }

  if(pathname === "/api/sync/v1/batch" && req.method === "POST"){
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      const parsed = body ? JSON.parse(body) : {};
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      items.forEach((item) => {
        if(!item || !item.key) return;
        space.items.set(item.key, { payload: item.payload || null, etag: makeEtag() });
      });
      return sendJson(res, 200, { ok: true });
    });
    return;
  }

  return sendJson(res, 404, { error: "not_found" });
}

async function serveStatic(req, res, root){
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);
  if(pathname.endsWith("/")) pathname += "index.html";
  if(pathname === "/") pathname = "/index.html";

  const filePath = path.join(root, pathname);
  try{
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  }catch(e){
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

export async function startTestServer({ port, root }){
  const spaces = new Map();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    if(url.pathname.startsWith("/api/sync/v1")){
      return handleSyncApi(req, res, spaces);
    }
    return serveStatic(req, res, root);
  });

  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    server,
    baseUrl: `http://127.0.0.1:${port}/`
  };
}

if(import.meta.url === `file://${process.argv[1]}`){
  const port = Number.parseInt(process.env.PORT || "5175", 10);
  const root = process.cwd();
  await startTestServer({ port, root });
  console.log(`Test server running at http://127.0.0.1:${port}/`);
}
