// @ts-check

import http from "http";
import { createRemoteClient } from "./remote_client.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

function startServer(){
  const state = { items: {} };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const path = url.pathname;
    if(path === "/api/sync/v1/index"){
      const items = Object.entries(state.items).map(([key, value]) => ({ key, hlc: value.hlc || "" }));
      res.writeHead(200, { "Content-Type": "application/json", "ETag": "W/index" });
      res.end(JSON.stringify({ items }));
      return;
    }
    if(path.startsWith("/api/sync/v1/item/")){
      const key = decodeURIComponent(path.slice("/api/sync/v1/item/".length));
      if(req.method === "GET"){
        const item = state.items[key];
        if(!item){
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "not_found" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json", "ETag": item.etag || "etag-1" });
        res.end(JSON.stringify(item.payload));
        return;
      }
      if(req.method === "PUT"){
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          const ifMatch = req.headers["if-match"] || "";
          const existing = state.items[key];
          if(existing && ifMatch && ifMatch !== existing.etag){
            res.writeHead(412, { "Content-Type": "application/json", "ETag": existing.etag || "" });
            res.end(JSON.stringify({ error: "precondition" }));
            return;
          }
          const payload = body ? JSON.parse(body) : null;
          const etag = `etag-${Date.now()}`;
          state.items[key] = { payload, etag, hlc: payload?.hlc || "" };
          res.writeHead(200, { "Content-Type": "application/json", "ETag": etag });
          res.end(JSON.stringify({ ok: true }));
        });
        return;
      }
    }
    if(path === "/api/sync/v1/batch" && req.method === "POST"){
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        const parsed = body ? JSON.parse(body) : {};
        const items = Array.isArray(parsed.items) ? parsed.items : [];
        items.forEach((item) => {
          if(!item || !item.key) return;
          state.items[item.key] = { payload: item.payload || null, etag: `etag-${item.key}`, hlc: item.payload?.hlc || "" };
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }
    if(path === "/api/sync/v1/create" && req.method === "POST"){
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ spaceId: "space-1", authToken: "token-1" }));
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, port: address.port, state });
    });
  });
}

const { server, port } = await startServer();
const endpoint = `http://127.0.0.1:${port}/api/sync/v1`;
const client = createRemoteClient(endpoint, { authToken: "secret", spaceId: "space-1" });

const createRes = await client.createSpace();
assert(createRes.ok, "createSpace ok");

const putRes = await client.putItem("meta", { hlc: "1:0:actor", foo: "bar" }, "*", "idem-1");
assert(putRes.ok, "putItem ok");
assert(putRes.etag, "putItem returns etag");

const getRes = await client.getItem("meta");
assert(getRes.ok, "getItem ok");
assert(getRes.data.foo === "bar", "getItem returns payload");

const idx = await client.getIndex();
assert(idx.ok, "getIndex ok");
assert(Array.isArray(idx.data.items), "index returns items");

const batchRes = await client.batch([{ key: "settings", payload: { hlc: "2:0:actor" } }], "idem-2");
assert(batchRes.ok, "batch ok");

server.close();
console.log("remote client tests: ok");
