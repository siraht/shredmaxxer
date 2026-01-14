// @ts-check

/**
 * @returns {Promise<"unknown"|"granted"|"denied">}
 */
export async function checkPersistStatus(){
  if(typeof navigator === "undefined" || !navigator.storage || typeof navigator.storage.persisted !== "function"){
    return "unknown";
  }

  try{
    const persisted = await navigator.storage.persisted();
    return persisted ? "granted" : "denied";
  }catch(e){
    return "unknown";
  }
}

/**
 * Request persistent storage if supported.
 * @returns {Promise<"unknown"|"granted"|"denied">}
 */
export async function requestPersist(){
  if(typeof navigator === "undefined" || !navigator.storage || typeof navigator.storage.persist !== "function"){
    return "unknown";
  }

  try{
    const granted = await navigator.storage.persist();
    return granted ? "granted" : "denied";
  }catch(e){
    return "unknown";
  }
}

export {};
