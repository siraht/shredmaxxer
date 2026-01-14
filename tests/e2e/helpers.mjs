// @ts-check

export async function openTab(page, tabId){
  await page.evaluate((id) => {
    const btn = document.getElementById(id);
    if(!btn){
      throw new Error(`Missing tab ${id}`);
    }
    btn.click();
  }, tabId);
  await page.waitForSelector(`#${tabId}.tab-active`);
  await page.waitForTimeout(60);
}

export async function openSegment(page, segId){
  await page.evaluate((targetSeg) => {
    const el = document.querySelector(`.segment[data-segment="${targetSeg}"]`);
    if(!el){
      throw new Error(`Missing segment ${targetSeg}`);
    }
    el.scrollIntoView({ block: "center" });
    el.click();
  }, segId);
  await page.waitForSelector("#sheet:not(.hidden)");
}

export async function closeSegment(page){
  await page.click("#doneSegment");
  await page.waitForSelector("#sheet", { state: "hidden" });
}

export async function setSegmented(page, rootSelector, value){
  await page.click(`${rootSelector} .seg-btn[data-value="${value}"]`);
}

export async function selectChipByLabel(page, containerSelector, label){
  await page.evaluate(({ containerSelector, label }) => {
    const container = document.querySelector(containerSelector);
    if(!container){
      throw new Error(`Missing chip container ${containerSelector}`);
    }
    const chips = Array.from(container.querySelectorAll(".chip"));
    const match = chips.find((chip) => (chip.textContent || "").trim() === label);
    if(!match){
      throw new Error(`Missing chip label ${label}`);
    }
    match.click();
  }, { containerSelector, label });
}

export async function expectText(page, selector, expected){
  const text = await page.locator(selector).innerText();
  if(!text.includes(expected)){
    throw new Error(`Expected ${selector} to include "${expected}", got "${text}"`);
  }
}

export async function waitForVisible(page, selector){
  const target = page.locator(selector);
  await target.waitFor({ state: "visible" });
}
