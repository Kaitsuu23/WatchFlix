import puppeteer, { Browser } from 'puppeteer-core';

let browserInstance: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
    if (browserInstance && browserInstance.connected) return browserInstance;

    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
        browserInstance = await puppeteer.launch({
            headless: true,
            executablePath:
                process.env.CHROME_PATH ||
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
    } else {
        const chromium = await import('@sparticuz/chromium');
        browserInstance = await puppeteer.launch({
            headless: true,
            executablePath: await chromium.default.executablePath(),
            args: chromium.default.args,
        });
    }

    browserInstance.on('disconnected', () => {
        browserInstance = null;
    });

    return browserInstance;
}

/**
 * Fetch HTML from a URL using Puppeteer (bypasses Cloudflare bot protection).
 * Waits for network to be idle before returning the page content.
 */
export async function fetchWithBrowser(url: string): Promise<{ html: string; finalUrl: string }> {
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        );
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8' });

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

        const html = await page.content();
        const finalUrl = page.url();
        return { html, finalUrl };
    } finally {
        await page.close();
    }
}
