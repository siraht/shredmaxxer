// @ts-check

export async function openTab(page, tabId){
  await page.click(`#${tabId}`);
  await page.waitForTimeout(80);
}

export async function openSegment(page, segId){
  await page.click(`.segment[data-segment="${segId}"]`);
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
  const chip = page.locator(`${containerSelector} .chip`, { hasText: label }).first();
  await chip.click();
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
