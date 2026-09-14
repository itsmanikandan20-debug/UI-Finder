import { chromium, type Browser, type Page } from "playwright";

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
    args: ["--disable-blink-features=AutomationControlled"],
  });
}

export async function newPage(browser: Browser, viewportWidth: number, viewportHeight = 1400): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: viewportWidth, height: viewportHeight },
    userAgent: DEFAULT_UA,
    locale: "en-US",
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(20000);
  page.setDefaultTimeout(10000);
  return page;
}

export async function loadPage(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  // Bounded wait for client-rendered content to settle — a slow
  // third-party script shouldn't be able to stall the whole crawl.
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(500);
}

const CHALLENGE_PATTERNS = [
  /checking your browser/i,
  /cf-browser-verification/i,
  /just a moment/i,
  /attention required/i,
  /verify you are human/i,
  /are you a robot/i,
  /access denied/i,
];

/** Best-effort detection of a bot-protection interstitial (Cloudflare, etc.) instead of the real page. */
export async function detectBotChallenge(page: Page): Promise<boolean> {
  const title = await page.title().catch(() => "");
  // A string, not a function — see the comment in extract.ts on why
  // page.evaluate() gets raw JS source here instead of a JS closure.
  const bodyText = (await page
    .evaluate('(document.body && document.body.innerText || "").slice(0, 2000)')
    .catch(() => "")) as string;
  const combined = `${title}\n${bodyText}`;
  return CHALLENGE_PATTERNS.some((re) => re.test(combined));
}
