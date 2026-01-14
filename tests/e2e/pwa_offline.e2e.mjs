// @ts-check

export const e2eConfig = { serviceWorkers: "allow" };

export async function run({ page, step, assert, helpers, context }){
  await step("load app + wait for SW ready", async () => {
    await helpers.goto("/");
    await page.waitForSelector(".segment");
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.ready);
    await helpers.goto("/");
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller);
  });

  await step("offline reload uses cache", async () => {
    await context.setOffline(true);
    await page.reload({ waitUntil: "load" });
    const tabCount = await page.locator("#tabToday").count();
    assert(tabCount === 1, "app loads while offline");
    await context.setOffline(false);
  });

  await step("trigger SW update + toast", async () => {
    await page.evaluate(() => {
      const url = new URL("sw.js", window.location.href);
      url.searchParams.set("e2e", String(Date.now()));
      return navigator.serviceWorker.register(url.toString());
    });
    await page.waitForSelector("#updateToast:not([hidden])");
  });

  return { status: "pass" };
}
