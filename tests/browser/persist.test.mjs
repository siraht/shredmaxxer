// @ts-check

import { checkPersistStatus, requestPersist } from "../../storage/persist.js";

export async function run({ logEvent, assert }){
  logEvent({ event: "persist_start" });

  const status = await checkPersistStatus();
  const allowed = ["unknown", "granted", "denied"];
  assert(allowed.includes(status), "checkPersistStatus returns allowed value");

  const requested = await requestPersist();
  assert(allowed.includes(requested), "requestPersist returns allowed value");

  logEvent({ event: "persist_done" });
  return { status: "pass" };
}
