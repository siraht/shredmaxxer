// @ts-check

import { createStore } from "./store.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const events = [];
const effects = [
  (action, next, prev) => events.push({ type: "effect", action: action.type, next, prev })
];

const store = createStore({
  initialState: { count: 0 },
  reducer(state, action){
    if(action.type === "INC") return { count: state.count + 1 };
    if(action.type === "NOOP") return state;
    return state;
  },
  effects
});

let listenerCalled = false;
store.subscribe((next, prev, action) => {
  listenerCalled = true;
  assert(prev.count === 0, "listener prev state");
  assert(next.count === 1, "listener next state");
  assert(action.type === "INC", "listener action type");
});

store.dispatch({ type: "INC" });
assert(store.getState().count === 1, "dispatch updates state");
assert(listenerCalled, "listener called on state change");
assert(events.length === 1 && events[0].action === "INC", "effect called on state change");

listenerCalled = false;
store.dispatch({ type: "NOOP" });
assert(!listenerCalled, "listener not called when state unchanged");

console.log("store tests: ok");
