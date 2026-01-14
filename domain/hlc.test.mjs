// @ts-check

import { compareHlc, maxHlc, parseHlc } from "./hlc.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const parsed = parseHlc("1700000000000:2:actor");
assert(parsed && parsed.ms === 1700000000000, "parseHlc ms");
assert(parsed && parsed.counter === 2, "parseHlc counter");
assert(parsed && parsed.actor === "actor", "parseHlc actor");
assert(parseHlc("bad") === null, "parseHlc invalid returns null");

const a = "1700000000000:1:actor-a";
const b = "1700000000001:0:actor-b";
assert(compareHlc(a, b) < 0, "compareHlc orders by ms");
assert(compareHlc(b, a) > 0, "compareHlc order reversed");
assert(compareHlc(a, a) === 0, "compareHlc equal");

const c = "1700000000000:2:actor-a";
assert(compareHlc(a, c) < 0, "compareHlc orders by counter when ms equal");

const d = "1700000000000:2:actor-b";
assert(compareHlc(c, d) < 0, "compareHlc orders by actor when ms/counter equal");

assert(compareHlc("", a) < 0, "compareHlc treats invalid as lower");
assert(maxHlc(a, b) === b, "maxHlc returns higher HLC");
assert(maxHlc("", a) === a, "maxHlc ignores invalid lower");

console.log("hlc tests: ok");
