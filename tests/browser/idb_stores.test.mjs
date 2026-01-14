// @ts-check

import { idbAdapter, isIndexedDbAvailable, openDatabase, STORES } from "../../storage/idb.js";

export async function run({ assert, logEvent }){
  if(!isIndexedDbAvailable()){
    return { status: "skip", reason: "IndexedDB not available" };
  }

  const db = await openDatabase();
  const names = Array.from(db.objectStoreNames);
  for(const store of Object.values(STORES)){
    assert(names.includes(store), `store ${store} exists`);
  }

  const list = await idbAdapter.listSnapshots();
  assert(Array.isArray(list), "listSnapshots returns array");

  let threw = false;
  try{
    await idbAdapter.saveSnapshot({ label: "bad" });
  }catch(e){
    threw = true;
  }
  assert(threw, "saveSnapshot requires id");

  db.close();
  logEvent({ event: "idb_stores", status: "ok" });
  return { status: "pass" };
}
