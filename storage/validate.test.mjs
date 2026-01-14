// @ts-check

import { validateImportPayload } from "./validate.js";

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
  highFatDay: "auto",
  energy: "",
  mood: "",
  cravings: "",
  notes: "",
  tsCreated: "2026-01-15T12:00:00.000Z",
  tsLast: "2026-01-15T12:00:00.000Z",
  rev: 0
};

const baseRosterItem = {
  id: "item-1",
  label: "Beef",
  aliases: [],
  tags: [],
  pinned: false,
  archived: false,
  tsCreated: "2026-01-01T00:00:00.000Z",
  tsUpdated: "2026-01-01T00:00:00.000Z"
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
    proteins: [baseRosterItem],
    carbs: [],
    fats: [],
    micros: []
  },
  logs: {
    "2026-01-15": baseDay
  }
};

const okResult = validateImportPayload(validPayload);
assert(okResult.ok, "valid payload should pass");

const triPayload = {
  ...validPayload,
  logs: {
    "2026-01-15": { ...baseDay, highFatDay: "auto" }
  }
};
const triResult = validateImportPayload(triPayload);
assert(triResult.ok, "tri highFatDay should pass");

const syncPayload = {
  ...validPayload,
  meta: {
    ...validPayload.meta,
    sync: { status: "idle" }
  },
  settings: {
    ...validPayload.settings,
    weekStart: 1,
    privacy: {
      ...validPayload.settings.privacy,
      blurOnBackground: true
    },
    sync: {
      mode: "hosted",
      endpoint: "/api/sync/v1",
      spaceId: "space-1",
      encryption: "none",
      pushDebounceMs: 2500,
      pullOnBoot: true
    }
  }
};
const syncResult = validateImportPayload(syncPayload);
assert(syncResult.ok, "sync settings payload should pass");

const badWeekStart = {
  ...syncPayload,
  settings: { ...syncPayload.settings, weekStart: 9 }
};
assert(!validateImportPayload(badWeekStart).ok, "invalid weekStart should fail");

const badSync = {
  ...syncPayload,
  settings: {
    ...syncPayload.settings,
    sync: { ...syncPayload.settings.sync, encryption: "bad", pullOnBoot: "yes" }
  }
};
assert(!validateImportPayload(badSync).ok, "invalid sync settings should fail");

const badPrivacy = {
  ...syncPayload,
  settings: {
    ...syncPayload.settings,
    privacy: { ...syncPayload.settings.privacy, blurOnBackground: "yes" }
  }
};
assert(!validateImportPayload(badPrivacy).ok, "invalid blurOnBackground should fail");

const legacyResult = validateImportPayload({ version: 3 });
assert(!legacyResult.ok && legacyResult.legacy, "legacy payload should fail with legacy flag");

const badDateKey = { ...validPayload, logs: { "2026/01/15": baseDay } };
const badResult = validateImportPayload(badDateKey);
assert(!badResult.ok, "invalid DateKey should fail");

console.log("validate tests: ok");
