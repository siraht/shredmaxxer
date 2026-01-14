// @ts-check

const output = document.getElementById("output");

function logEvent(event){
  console.log(JSON.stringify(event));
  if(output){
    output.textContent += `\n${JSON.stringify(event)}`;
  }
}

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

function getQuery(){
  const params = new URLSearchParams(window.location.search);
  return {
    filter: params.get("filter") || ""
  };
}

async function clearStorage(){
  try{
    localStorage.clear();
  }catch(e){
    // ignore
  }
  if(typeof indexedDB !== "undefined"){
    try{
      await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase("shredmaxx_solar_log");
        req.onsuccess = () => resolve(null);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      });
    }catch(e){
      // ignore
    }
  }
}

const TESTS = [
  { name: "adapter_idb", path: "./adapter_idb.test.mjs" },
  { name: "encrypted_export", path: "./encrypted_export.test.mjs" },
  { name: "idb_stores", path: "./idb_stores.test.mjs" },
  { name: "snapshots", path: "./snapshots.test.mjs" }
];

async function run(){
  const { filter } = getQuery();
  const selected = TESTS.filter((t) => !filter || t.name.includes(filter) || t.path.includes(filter));

  logEvent({ event: "suite_start", ts: new Date().toISOString(), test_count: selected.length, filter });

  if(selected.length === 0){
    logEvent({ event: "suite_empty", message: "No tests matched filter" });
    window.__TEST_RESULTS__ = { passed: 0, failed: 0, skipped: 0, total: 0 };
    window.__TEST_DONE__ = true;
    return;
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for(const test of selected){
    await clearStorage();
    const start = Date.now();
    logEvent({ event: "test_start", name: test.name, ts: new Date(start).toISOString() });
    try{
      const mod = await import(test.path);
      if(typeof mod.run !== "function"){
        throw new Error(`Test module ${test.path} missing run()`);
      }
      const res = await mod.run({ logEvent, assert });
      if(res && res.status === "skip"){
        skipped += 1;
        logEvent({ event: "test_result", name: test.name, status: "skip", duration_ms: Date.now() - start, reason: res.reason || "" });
      }else{
        passed += 1;
        logEvent({ event: "test_result", name: test.name, status: "pass", duration_ms: Date.now() - start });
      }
    }catch(err){
      failed += 1;
      logEvent({ event: "test_result", name: test.name, status: "fail", duration_ms: Date.now() - start });
      logEvent({ event: "test_failure", name: test.name, message: err?.message || String(err) });
      break;
    }
  }

  logEvent({ event: "suite_end", passed, failed, skipped, total: selected.length, ts: new Date().toISOString() });
  window.__TEST_RESULTS__ = { passed, failed, skipped, total: selected.length };
  window.__TEST_DONE__ = true;
}

run();
