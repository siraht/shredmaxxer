// @ts-check

export function getElements(){
  return {
    // tabs/views
    tabToday: document.getElementById("tabToday"),
    tabHistory: document.getElementById("tabHistory"),
    tabReview: document.getElementById("tabReview"),
    tabSettings: document.getElementById("tabSettings"),
    viewToday: document.getElementById("viewToday"),
    viewHistory: document.getElementById("viewHistory"),
    viewReview: document.getElementById("viewReview"),
    viewSettings: document.getElementById("viewSettings"),

    // today head
    prevDay: document.getElementById("prevDay"),
    nextDay: document.getElementById("nextDay"),
    datePicker: document.getElementById("datePicker"),
    phaseLabel: document.getElementById("phaseLabel"),
    phaseSub: document.getElementById("phaseSub"),
    toggleFocus: document.getElementById("toggleFocus"),
    focusLabel: document.getElementById("focusLabel"),

    // timeline
    timelineTrack: document.getElementById("timelineTrack"),
    nowMarker: document.getElementById("nowMarker"),
    futureFog: document.getElementById("futureFog"),

    sunArc: document.getElementById("sunArc"),
    sunDot: document.getElementById("sunDot"),
    sunGlow: document.getElementById("sunGlow"),
    sunTime: document.getElementById("sunTime"),

    // rituals
    movedBeforeLunch: document.getElementById("movedBeforeLunch"),
    trained: document.getElementById("trained"),
    highFatDay: document.getElementById("highFatDay"),
    moveSub: document.getElementById("moveSub"),
    trainSub: document.getElementById("trainSub"),
    fatDaySub: document.getElementById("fatDaySub"),

    // signals
    energyScale: document.getElementById("energyScale"),
    moodScale: document.getElementById("moodScale"),
    cravingsScale: document.getElementById("cravingsScale"),

    // daily notes
    notes: document.getElementById("notes"),

    // history
    historyList: document.getElementById("historyList"),
    exportBtn: document.getElementById("exportBtn"),
    importFile: document.getElementById("importFile"),
    importMode: document.getElementById("importMode"),
    importApply: document.getElementById("importApply"),
    importStatus: document.getElementById("importStatus"),
    reviewRange: document.getElementById("reviewRange"),
    coverageMatrix: document.getElementById("coverageMatrix"),
    rotationPicks: document.getElementById("rotationPicks"),

    undoToast: document.getElementById("undoToast"),
    undoLabel: document.getElementById("undoLabel"),
    undoAction: document.getElementById("undoAction"),

    // settings
    setDayStart: document.getElementById("setDayStart"),
    setDayEnd: document.getElementById("setDayEnd"),
    setFtnEnd: document.getElementById("setFtnEnd"),
    setLunchEnd: document.getElementById("setLunchEnd"),
    setDinnerEnd: document.getElementById("setDinnerEnd"),
    setSunrise: document.getElementById("setSunrise"),
    setSunset: document.getElementById("setSunset"),
    setSunMode: document.getElementById("setSunMode"),
    setPhase: document.getElementById("setPhase"),
    setFocusMode: document.getElementById("setFocusMode"),
    saveSettings: document.getElementById("saveSettings"),
    resetToday: document.getElementById("resetToday"),

    rosterProteins: document.getElementById("roster-proteins"),
    rosterCarbs: document.getElementById("roster-carbs"),
    rosterFats: document.getElementById("roster-fats"),
    rosterMicros: document.getElementById("roster-micros"),

    // sheet
    sheet: document.getElementById("sheet"),
    sheetBackdrop: document.getElementById("sheetBackdrop"),
    closeSheet: document.getElementById("closeSheet"),
    doneSegment: document.getElementById("doneSegment"),
    clearSegment: document.getElementById("clearSegment"),
    sheetTitle: document.getElementById("sheetTitle"),
    sheetSub: document.getElementById("sheetSub"),
    ftnModeRow: document.getElementById("ftnModeRow"),
    ftnModeSeg: document.getElementById("ftnModeSeg"),

    searchProteins: document.getElementById("searchProteins"),
    searchCarbs: document.getElementById("searchCarbs"),
    searchFats: document.getElementById("searchFats"),
    searchMicros: document.getElementById("searchMicros"),

    chipsProteins: document.getElementById("chipsProteins"),
    chipsCarbs: document.getElementById("chipsCarbs"),
    chipsFats: document.getElementById("chipsFats"),
    chipsMicros: document.getElementById("chipsMicros"),
    searchProteins: document.getElementById("searchProteins"),
    searchCarbs: document.getElementById("searchCarbs"),
    searchFats: document.getElementById("searchFats"),
    searchMicros: document.getElementById("searchMicros"),

    addProtein: document.getElementById("addProtein"),
    addCarb: document.getElementById("addCarb"),
    addFat: document.getElementById("addFat"),
    addMicro: document.getElementById("addMicro"),

    searchProteins: document.getElementById("searchProteins"),
    searchCarbs: document.getElementById("searchCarbs"),
    searchFats: document.getElementById("searchFats"),
    searchMicros: document.getElementById("searchMicros"),

    segCollision: document.getElementById("segCollision"),
    segHighFat: document.getElementById("segHighFat"),
    segSeedOil: document.getElementById("segSeedOil"),
    segStatus: document.getElementById("segStatus"),
    segNotes: document.getElementById("segNotes"),
    flagHelp: document.getElementById("flagHelp"),

    undoToast: document.getElementById("undoToast"),
    undoMsg: document.getElementById("undoMsg"),
    undoBtn: document.getElementById("undoBtn")
  };
}
