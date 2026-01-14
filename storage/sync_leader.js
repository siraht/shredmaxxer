// @ts-check

const DEFAULT_CHANNEL = "shredmaxx_sync_leader";
const DEFAULT_LOCK_KEY = "shredmaxx_sync_leader_lock";

function safeParse(raw){
  try{
    return JSON.parse(raw);
  }catch(e){
    return null;
  }
}

function generateId(){
  if(typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"){
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * @param {{
 *  channelName?: string,
 *  lockKey?: string,
 *  heartbeatMs?: number,
 *  timeoutMs?: number,
 *  onLeaderChange?: (isLeader:boolean, leaderId:string)=>void
 * }} opts
 */
export function createSyncLeader(opts = {}){
  const channelName = opts.channelName || DEFAULT_CHANNEL;
  const lockKey = opts.lockKey || DEFAULT_LOCK_KEY;
  const heartbeatMs = Number.isFinite(opts.heartbeatMs) ? opts.heartbeatMs : 2000;
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 5000;
  const onLeaderChange = typeof opts.onLeaderChange === "function" ? opts.onLeaderChange : () => {};

  const id = generateId();
  let leaderId = "";
  let leader = false;
  let timer = null;
  let channel = null;

  function readLock(){
    try{
      const raw = localStorage.getItem(lockKey);
      return raw ? safeParse(raw) : null;
    }catch(e){
      return null;
    }
  }

  function writeLock(){
    try{
      localStorage.setItem(lockKey, JSON.stringify({ id, ts: Date.now() }));
    }catch(e){
      // ignore lock write failures
    }
  }

  function isExpired(lock){
    if(!lock || !lock.ts) return true;
    return (Date.now() - Number(lock.ts || 0)) > timeoutMs;
  }

  function setLeader(nextLeaderId){
    const nextIsLeader = nextLeaderId === id;
    const changed = leader !== nextIsLeader || leaderId !== nextLeaderId;
    leader = nextIsLeader;
    leaderId = nextLeaderId;
    if(changed){
      onLeaderChange(leader, leaderId);
    }
  }

  function broadcastLeader(){
    if(channel){
      channel.postMessage({ type: "leader", id, ts: Date.now() });
    }
  }

  function tryClaim(){
    const lock = readLock();
    if(!lock || isExpired(lock)){
      writeLock();
      setLeader(id);
      broadcastLeader();
      return true;
    }
    setLeader(lock.id || "");
    return false;
  }

  function heartbeat(){
    if(leader){
      writeLock();
      broadcastLeader();
      return;
    }
    tryClaim();
  }

  function onMessage(message){
    const data = message?.data || message;
    if(!data || data.type !== "leader") return;
    if(data.id && data.id !== id){
      setLeader(data.id);
    }
  }

  function onStorage(event){
    if(event.key !== lockKey) return;
    const lock = safeParse(event.newValue);
    if(lock && lock.id){
      setLeader(lock.id);
    }
  }

  function start(){
    tryClaim();
    if(typeof BroadcastChannel !== "undefined"){
      channel = new BroadcastChannel(channelName);
      channel.addEventListener("message", onMessage);
    }
    if(typeof window !== "undefined"){
      window.addEventListener("storage", onStorage);
    }
    timer = setInterval(heartbeat, heartbeatMs);
  }

  function stop(){
    if(timer) clearInterval(timer);
    timer = null;
    if(channel){
      channel.removeEventListener("message", onMessage);
      channel.close();
      channel = null;
    }
    if(typeof window !== "undefined"){
      window.removeEventListener("storage", onStorage);
    }
  }

  return {
    id,
    start,
    stop,
    isLeader: () => leader,
    leaderId: () => leaderId
  };
}

export { DEFAULT_CHANNEL, DEFAULT_LOCK_KEY };
export {};
