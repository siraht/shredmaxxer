// @ts-check

import { parseImportText } from "./import.js";

function assert(condition, label){
  if(!condition){
    throw new Error(`Assertion failed: ${label}`);
  }
}

const baseSegment = {
  status: "",
  proteins: [],
  carbs: [],
  fats: [],
  micros: [],
  collision: "",
  seedOil: "",
  highFatMeal: "",
  notes: "",
  rev: 0
};

const baseDay = {
  segments: {
    ftn: { ...baseSegment, ftnMode: "" },
    lunch: { ...baseSegment },
    dinner: { ...baseSegment },
    late: { ...baseSegment }
  },
  movedBeforeLunch: false,
  trained: false,
  highFatDay: false,
  energy: "",
  mood: "",
  cravings: "",
  notes: "",
  tsCreated: "2026-01-15T12:00:00.000Z",
  tsLast: "2026-01-15T12:00:00.000Z",
  rev: 0
};

const validPayload = {
  version: 4,
  meta: {
    version: 4,
    installId: "install-1",
    storageMode: "idb",
    persistStatus: "unknown"
  },
  settings: {
    dayStart: "06:00",
    dayEnd: "23:59",
    ftnEnd: "12:00",
    lunchEnd: "16:00",
    dinnerEnd: "21:00",
    focusMode: "full",
    sunMode: "manual",
    sunrise: "07:00",
    sunset: "17:00",
    phase: "",
    privacy: {
      appLock: false,
      redactHome: false,
      exportEncryptedByDefault: false
    }
  },
  rosters: {
    proteins: [],
    carbs: [],
    fats: [],
    micros: []
  },
  logs: {
    "2026-01-15": baseDay
  }
};

const good = parseImportText(JSON.stringify(validPayload));
assert(good.ok, "valid payload passes");
assert(!!good.payload, "payload returned on success");

const badJson = parseImportText("{not-json");
assert(!badJson.ok, "invalid JSON fails");
assert(badJson.errors.length > 0, "invalid JSON returns errors");

const legacy = parseImportText(JSON.stringify({ version: 3 }));
assert(!legacy.ok, "legacy payload fails");
assert(legacy.legacy === true, "legacy flag is true");

console.log("import tests: ok");
