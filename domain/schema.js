// @ts-check

/**
 * Canonical date key: YYYY-MM-DD in local time (date of dayStart).
 * @typedef {string} DateKey
 */

/** @typedef {"ftn"|"lunch"|"dinner"|"late"} SegmentId */

/** @typedef {""|"none"|"yes"} SeedOil */
/** @typedef {""|"ftn"|"lite"|"off"} FtnMode */

/**
 * Tri-state with auto support.
 * "" is treated as auto for legacy compatibility.
 * @typedef {""|"auto"|"yes"|"no"} Tri
 */

/** @typedef {""|"unlogged"|"none"|"logged"} SegmentStatus */
/** @typedef {""|"1"|"2"|"3"|"4"|"5"} Signal */

/** @typedef {string} ItemId */
/** @typedef {string} ItemTag */

/**
 * @typedef {Object} RosterItem
 * @property {ItemId} id
 * @property {string} label
 * @property {string[]} aliases
 * @property {ItemTag[]} tags
 * @property {boolean} pinned
 * @property {boolean} archived
 * @property {string} tsCreated  ISO timestamp
 * @property {string} tsUpdated  ISO timestamp
 */

/**
 * @typedef {Object} SegmentLog
 * @property {FtnMode} [ftnMode]
 * @property {SegmentStatus} status
 * @property {ItemId[]} proteins
 * @property {ItemId[]} carbs
 * @property {ItemId[]} fats
 * @property {ItemId[]} micros
 * @property {Tri} collision
 * @property {SeedOil} seedOil
 * @property {Tri} highFatMeal
 * @property {string} notes
 * @property {string} [tsFirst]
 * @property {string} [tsLast]
 * @property {number} rev
 */

/**
 * @typedef {Object} SupplementsLog
 * @property {""|"none"|"essential"|"advanced"} mode
 * @property {ItemId[]} items
 * @property {string} notes
 * @property {string} [tsLast]
 */

/**
 * @typedef {Object} DayLog
 * @property {Record<SegmentId, SegmentLog>} segments
 * @property {boolean} movedBeforeLunch
 * @property {boolean} trained
 * @property {boolean} highFatDay
 * @property {SupplementsLog} [supplements]
 * @property {Signal} energy
 * @property {Signal} mood
 * @property {Signal} cravings
 * @property {string} notes
 * @property {string} tsCreated
 * @property {string} tsLast
 * @property {number} rev
 */

/**
 * @typedef {Object} Settings
 * @property {string} dayStart  HH:MM
 * @property {string} dayEnd    HH:MM
 * @property {string} ftnEnd    HH:MM
 * @property {string} lunchEnd  HH:MM
 * @property {string} dinnerEnd HH:MM
 * @property {"full"|"nowfade"} focusMode
 * @property {"manual"|"auto"} sunMode
 * @property {string} sunrise   HH:MM
 * @property {string} sunset    HH:MM
 * @property {number} [lastKnownLat]
 * @property {number} [lastKnownLon]
 * @property {""|"strict"|"maintenance"|"advanced"} phase
 * @property {number} weekStart 0=Sunday, 1=Monday, ...
 * @property {boolean} nudgesEnabled
 * @property {""|"none"|"essential"|"advanced"} supplementsMode
 * @property {{
 *   appLock: boolean,
 *   redactHome: boolean,
 *   exportEncryptedByDefault: boolean,
 *   blurOnBackground: boolean
 * }} privacy
 */

/**
 * @typedef {Object} Rosters
 * @property {RosterItem[]} proteins
 * @property {RosterItem[]} carbs
 * @property {RosterItem[]} fats
 * @property {RosterItem[]} micros
 * @property {RosterItem[]} [supplements]
 */

/**
 * @typedef {Object} Snapshot
 * @property {string} id
 * @property {string} ts
 * @property {string} label
 * @property {string} payload
 */

/**
 * @typedef {Object} Meta
 * @property {4} version
 * @property {string} installId
 * @property {string} [appVersion]
 * @property {"idb"|"localStorage"} storageMode
 * @property {""|"unknown"|"granted"|"denied"} persistStatus
 * @property {string} [lastSnapshotTs]
 */

/**
 * @typedef {Object} InsightsState
 * @property {{
 *  day: Record<string, Record<string, string>>,
 *  week: Record<string, Record<string, string>>
 * }} dismissed
 */

/**
 * @typedef {Object} TrackerState
 * @property {4} version
 * @property {Meta} meta
 * @property {Settings} settings
 * @property {Rosters} rosters
 * @property {InsightsState} insights
 * @property {Record<DateKey, DayLog>} logs
 */

export {};
