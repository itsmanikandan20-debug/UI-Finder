import { chromium, type Browser, type LaunchOptions, type Page } from "playwright-core";

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const LAUNCH_ARGS = ["--disable-blink-features=AutomationControlled"];

async function tryLaunch(options: LaunchOptions): Promise<Browser | null> {
  try {
    return await chromium.launch(options);
  } catch {
    return null;
  }
}

/**
 * Uses whatever Chrome or Edge is already installed on this machine —
 * via Playwright's `channel` option, which launches a real system
 * browser install rather than a separate Playwright-managed download.
 * We depend on `playwright-core` (not `playwright`), which never
 * downloads its own Chromium build, so there is nothing to fetch here
 * and no `npx playwright install` step required for normal setup.
 *
 * Order: an explicit override (useful in CI/sandboxes with a pinned
 * browser build) → installed Chrome → installed Edge → a clear,
 * actionable error instead of a crash or a surprise download.
 */
export async function launchBrowser(): Promise<Browser> {
  const explicitPath = process.env.CHROMIUM_EXECUTABLE_PATH;
  if (explicitPath) {
    const browser = await tryLaunch({ headless: true, executablePath: explicitPath, args: LAUNCH_ARGS });
    if (browser) return browser;
    throw new Error(
      `CHROMIUM_EXECUTABLE_PATH is set to "${explicitPath}" but Playwright could not launch it. ` +
        "Check that the path points at an actual browser executable."
    );
  }

  const chrome = await tryLaunch({ headless: true, channel: "chrome", args: LAUNCH_ARGS });
  if (chrome) return chrome;

  const edge = await tryLaunch({ headless: true, channel: "msedge", args: LAUNCH_ARGS });
  if (edge) return edge;

  throw new Error(
    "UI-Finder's crawler needs Google Chrome or Microsoft Edge installed, but couldn't find either.\n" +
      "Install Google Chrome (https://www.google.com/chrome/) or Microsoft Edge " +
      "(https://www.microsoft.com/edge), then try again — no other setup is needed.\n" +
      "If a browser is installed somewhere UI-Finder can't find automatically, set " +
      "CHROMIUM_EXECUTABLE_PATH in your .env.local to its full path, e.g.\n" +
      'CHROMIUM_EXECUTABLE_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"'
  );
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
