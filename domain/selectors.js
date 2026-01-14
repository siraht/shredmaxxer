// @ts-check

/**
 * @typedef {import("./schema.js").TrackerState} TrackerState
 * @typedef {import("./schema.js").SegmentLog} SegmentLog
 */

/**
 * @param {TrackerState} state
 * @param {string} dateKey
 */
export function selectDay(state, dateKey){
  return state.logs?.[dateKey] || null;
}

/**
 * @param {TrackerState} state
 * @param {string} dateKey
 * @param {"ftn"|"lunch"|"dinner"|"late"} segmentId
 */
export function selectSegment(state, dateKey, segmentId){
  const day = selectDay(state, dateKey);
  return day?.segments?.[segmentId] || null;
}

/**
 * @param {SegmentLog} seg
 */
export function segmentCounts(seg){
  return {
    proteins: seg.proteins?.length || 0,
    carbs: seg.carbs?.length || 0,
    fats: seg.fats?.length || 0,
    micros: seg.micros?.length || 0
  };
}
