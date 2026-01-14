// @ts-check

import { openTab } from "./helpers.mjs";

export async function run({ page, step, assert, helpers, context, logEvent }){
  await step("load app", async () => {
    await helpers.goto("/");
    await page.waitForSelector(".segment");
  });

  await step("enable redaction", async () => {
    await openTab(page, "tabSettings");
    await page.check("#privacyRedactToggle");
    await openTab(page, "tabToday");
    const notesHidden = await page.locator("#notesBlock").isHidden();
    const bannerHidden = await page.locator("#redactionBanner").isHidden();
    assert(notesHidden, "notes block hidden when redaction enabled");
    assert(!bannerHidden, "redaction banner visible");
  });

  await step("set app lock passcode", async () => {
    await openTab(page, "tabSettings");
    helpers.queueDialog("1234");
    helpers.queueDialog("1234");
    await page.click("#appLockSetBtn");
    await page.waitForFunction(() => {
      try{
        const hash = localStorage.getItem("shredmaxx_app_lock_hash");
        const salt = localStorage.getItem("shredmaxx_app_lock_salt");
        return !!(hash && salt);
      }catch(e){
        return false;
      }
    });
  });

  await step("app lock blocks on reload", async () => {
    await page.reload({ waitUntil: "load" });
    const overlayHidden = await page.locator("#appLockOverlay").isHidden();
    assert(!overlayHidden, "app lock overlay visible after reload");
    await page.fill("#appLockInput", "0000");
    await page.click("#appLockSubmit");
    await page.waitForFunction(() => {
      const msg = document.getElementById("appLockMessage");
      return msg && msg.textContent && msg.textContent.toLowerCase().includes("incorrect");
    });
    await page.fill("#appLockInput", "1234");
    await page.click("#appLockSubmit");
    await page.waitForTimeout(200);
    const hiddenNow = await page.locator("#appLockOverlay").isHidden();
    assert(hiddenNow, "app lock overlay dismissed after unlock");
  });

  await step("disable app lock with verification", async () => {
    await openTab(page, "tabSettings");
    await page.uncheck("#privacyAppLockToggle");
    helpers.queueDialog("1234");
    await page.click("#saveSettings");
    await page.waitForTimeout(200);
    const checked = await page.locator("#privacyAppLockToggle").isChecked();
    assert(!checked, "app lock disabled");
  });

  await step("app lock stays disabled after reload", async () => {
    await page.reload({ waitUntil: "load" });
    const overlayHidden = await page.locator("#appLockOverlay").isHidden();
    assert(overlayHidden, "app lock overlay stays hidden");
  });

  await step("privacy blur toggles on background", async () => {
    await page.check("#privacyBlurToggle");
    const other = await context.newPage();
    await other.goto("about:blank");
    await other.bringToFront();
    const becameHidden = await page.waitForFunction(() => document.hidden === true, { timeout: 2000 })
      .then(() => true)
      .catch(() => false);
    if(!becameHidden){
      logEvent({ event: "step_note", test: "privacy", message: "visibilitychange not observed; blur check skipped" });
      await other.close();
      return;
    }
    await page.waitForFunction(() => {
      const overlay = document.getElementById("privacyBlurOverlay");
      return overlay && !overlay.classList.contains("hidden");
    });
    await page.bringToFront();
    await page.waitForFunction(() => {
      const overlay = document.getElementById("privacyBlurOverlay");
      return overlay && overlay.classList.contains("hidden");
    });
    await other.close();
  });

  return { status: "pass" };
}
