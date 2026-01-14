// @ts-check

import { nextHlc, createHlcClock } from "./hlc_clock.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

function parse(hlc){
  const [ms, counter, actor] = String(hlc).split(":");
  return { ms: Number(ms), counter: Number(counter), actor };
}

const base = nextHlc("", "actor", 1000);
let parsed = parse(base);
assert(parsed.ms === 1000, "nextHlc uses nowMs");
assert(parsed.counter === 0, "nextHlc counter starts at 0");
assert(parsed.actor === "actor", "nextHlc actor set");

const sameTick = nextHlc(base, "actor", 1000);
parsed = parse(sameTick);
assert(parsed.ms === 1000, "nextHlc keeps same ms when equal");
assert(parsed.counter === 1, "nextHlc increments counter when equal");

const olderTick = nextHlc(base, "actor", 900);
parsed = parse(olderTick);
assert(parsed.ms === 1000, "nextHlc clamps to last ms when now is older");
assert(parsed.counter === 1, "nextHlc increments counter when now is older");

const newerTick = nextHlc(base, "actor", 1200);
parsed = parse(newerTick);
assert(parsed.ms === 1200, "nextHlc advances ms when newer");
assert(parsed.counter === 0, "nextHlc resets counter when newer");

const clock = createHlcClock("alpha", "100:2:alpha");
const tick1 = clock.tick(100);
parsed = parse(tick1);
assert(parsed.ms === 100 && parsed.counter === 3, "clock increments counter on same ms");
const tick2 = clock.tick(200);
parsed = parse(tick2);
assert(parsed.ms === 200 && parsed.counter === 0, "clock resets counter on newer ms");
clock.setLast("300:5:alpha");
assert(clock.getLast() === "300:5:alpha", "clock setLast/getLast works");

console.log("hlc clock tests: ok");
