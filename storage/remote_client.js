// @ts-check

const DEFAULT_ENDPOINT = "/api/sync/v1";

function buildUrl(endpoint, path, spaceId){
  const base = endpoint || DEFAULT_ENDPOINT;
  const origin = (typeof window !== "undefined" && window.location && window.location.origin)
    ? window.location.origin
    : "http://localhost";
  const url = new URL(`${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`, origin);
  if(spaceId){
    url.searchParams.set("spaceId", spaceId);
  }
  return url.toString();
}

/**
 * @param {string} endpoint
 * @param {{ authToken?: string, spaceId?: string }} creds
 * @param {typeof fetch} [fetchImpl]
 */
export function createRemoteClient(endpoint, creds, fetchImpl){
  const authToken = creds?.authToken || "";
  const spaceId = creds?.spaceId || "";
  const fetchFn = fetchImpl || fetch;

  const baseHeaders = () => {
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    };
    if(authToken){
      headers.Authorization = `Bearer ${authToken}`;
    }
    return headers;
  };

  async function request(method, path, opts = {}){
    const url = buildUrl(endpoint, path, spaceId);
    const headers = { ...baseHeaders(), ...(opts.headers || {}) };
    const body = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
    const res = await fetchFn(url, {
      method,
      headers,
      body,
      cache: "no-store",
      credentials: "same-origin"
    });
    const etag = res.headers.get("ETag") || "";
    let data = null;
    const contentType = res.headers.get("Content-Type") || "";
    if(contentType.includes("application/json")){
      try{
        data = await res.json();
      }catch(e){
        data = null;
      }
    }else{
      try{
        data = await res.text();
      }catch(e){
        data = null;
      }
    }
    return { ok: res.ok, status: res.status, data, etag, headers: res.headers };
  }

  return {
    async getIndex(){
      return request("GET", "index");
    },
    async getItem(key){
      return request("GET", `item/${encodeURIComponent(key)}`);
    },
    async putItem(key, payload, etag, idempotencyKey){
      const headers = {};
      if(etag !== undefined){
        headers["If-Match"] = etag || "*";
      }
      if(idempotencyKey){
        headers["Idempotency-Key"] = idempotencyKey;
      }
      return request("PUT", `item/${encodeURIComponent(key)}`, { body: payload, headers });
    },
    async batch(items, idempotencyKey){
      const headers = {};
      if(idempotencyKey){
        headers["Idempotency-Key"] = idempotencyKey;
      }
      return request("POST", "batch", { body: { items }, headers });
    },
    async createSpace(){
      return request("POST", "create");
    }
  };
}

export { DEFAULT_ENDPOINT };
export {};
