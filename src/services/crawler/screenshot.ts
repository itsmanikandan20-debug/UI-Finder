import type { Page } from "playwright-core";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Captures a compressed crop of one detected section. Scrolls the
 * section into view first since Playwright's `clip` is relative to the
 * current viewport, not the full document — most sections sit below the
 * fold on any real page.
 */
export async function captureSectionScreenshot(
  page: Page,
  box: Box,
  outPath: string,
  viewportWidth: number
): Promise<boolean> {
  try {
    // Raw JS source strings, not function closures — see extract.ts for why.
    await page.evaluate(`window.scrollTo(0, Math.max(0, ${box.y} - 20))`);
    await page.waitForTimeout(150);
    const scrollY = (await page.evaluate("window.scrollY")) as number;

    const clip = {
      x: Math.max(0, Math.min(box.x, viewportWidth - 10)),
      y: Math.max(0, box.y - scrollY),
      width: Math.min(box.width, viewportWidth - Math.max(0, box.x)),
      height: Math.min(box.height, 1600),
    };
    if (clip.width < 10 || clip.height < 10) return false;

    await page.screenshot({ path: outPath, clip, type: "jpeg", quality: 55 });
    return true;
  } catch {
    return false;
  }
}
