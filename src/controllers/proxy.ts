import axios from 'axios';
import { Request, Response } from 'express';
import { getBrowser } from '@/utils/browser';

const BLOCKED_HEADERS = [
    'content-security-policy',
    'content-security-policy-report-only',
    'x-frame-options',
    'origin-agent-cluster',
    'permissions-policy',
];

const ALLOWED_DOMAINS = ['playeriframe.sbs', 'playeriframe.lol', 'hownetwork.xyz'];
const BROWSER_DOMAINS = ['playeriframe.sbs', 'playeriframe.lol', 'hownetwork.xyz'];
const PROXY_TIMEOUT = 5000;

// Cache rendered HTML per URL (5 min TTL)
const htmlCache = new Map<string, { html: string; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function fetchHtmlWithBrowser(url: string): Promise<string> {
    const cached = htmlCache.get(url);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.html;

    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        // Spoof headless detection
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            (window as any).chrome = { runtime: {} };
        });

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

        // Wait for Cloudflare challenge to resolve if present
        await page.waitForFunction(
            () => !document.title.includes('Just a moment'),
            { timeout: 10000 },
        ).catch(() => {});

        const html = await page.content();
        htmlCache.set(url, { html, ts: Date.now() });
        return html;
    } finally {
        await page.close();
    }
}

async function fetchAndProxy(target: string, req: Request, res: Response) {
    let parsed: URL;
    try {
        parsed = new URL(target);
    } catch {
        res.status(400).send('Invalid url');
        return;
    }

    const referer = req.headers['referer'] || '';
    const isInternalChain = referer.includes('/proxy?url=');
    if (!isInternalChain && !ALLOWED_DOMAINS.some((d) => parsed.hostname === d || parsed.hostname.endsWith('.' + d))) {
        res.status(403).send('Domain not allowed');
        return;
    }

    const needsBrowser = BROWSER_DOMAINS.some((d) => parsed.hostname.endsWith(d));
    const isHtmlRequest = !parsed.pathname.match(/\.(js|css|png|jpg|gif|svg|ico|woff|woff2|ttf|mp4|m3u8|ts)(\?|$)/i);

    try {
        if (needsBrowser && isHtmlRequest) {
            const html = await fetchHtmlWithBrowser(target);
            const basePath = `${parsed.protocol}//${parsed.host}${parsed.pathname.substring(0, parsed.pathname.lastIndexOf('/') + 1)}`;
            const baseOrigin = `${parsed.protocol}//${parsed.host}`;

            let rewritten = html
                .replace(
                    /((?:src|href|action|data-src)=["'])(https?:\/\/[^"']+)(["'])/gi,
                    (_m, pre, url, post) => `${pre}/proxy?url=${encodeURIComponent(url)}${post}`,
                )
                .replace(
                    /((?:src|href)=["'])(\/[^"']+)(["'])/gi,
                    (_m, pre, path, post) => `${pre}/proxy?url=${encodeURIComponent(baseOrigin + path)}${post}`,
                )
                .replace(
                    /((?:src|href)=["'])(?!https?:\/\/|\/|data:|javascript:|#)([^"']+)(["'])/gi,
                    (_m, pre, path, post) => `${pre}/proxy?url=${encodeURIComponent(basePath + path)}${post}`,
                )
                .replace(/document\.domain\s*=\s*["'][^"']*["']/g, '/* patched */');

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Origin-Agent-Cluster', '?0');
            res.setHeader('Permissions-Policy', 'autoplay=*, fullscreen=*, picture-in-picture=*, bluetooth=*');
            res.send(rewritten);
            return;
        }

        let proxyReferer = `${parsed.protocol}//${parsed.host}/`;
        let proxyOrigin = `${parsed.protocol}//${parsed.host}`;
        
        // Emulate referer from the primary domain when fetching .xyz video segments
        if (parsed.hostname.endsWith('.xyz') && parsed.hostname !== 'hownetwork.xyz' && parsed.hostname !== 'cloud.hownetwork.xyz') {
            proxyReferer = 'https://hownetwork.xyz/';
            proxyOrigin = 'https://hownetwork.xyz';
        }

        // Axios for non-HTML or non-browser-domain requests
        const upstream = await axios.get(target, {
            responseType: 'arraybuffer',
            timeout: PROXY_TIMEOUT,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
                Referer: proxyReferer,
                Origin: proxyOrigin,
                Accept: '*/*',
                'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
            },
            maxRedirects: 5,
        });

        Object.entries(upstream.headers).forEach(([key, val]) => {
            const k = key.toLowerCase();
            if (BLOCKED_HEADERS.includes(k)) return;
            if (k === 'transfer-encoding' || k === 'content-encoding') return;
            if (val) res.setHeader(key, val as string);
        });

        res.setHeader('Origin-Agent-Cluster', '?0');
        res.setHeader('Permissions-Policy', 'autoplay=*, fullscreen=*, picture-in-picture=*, bluetooth=*');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const contentType = (upstream.headers['content-type'] as string) || '';
        const baseOrigin = `${parsed.protocol}//${parsed.host}`;
        const basePath = `${parsed.protocol}//${parsed.host}${parsed.pathname.substring(0, parsed.pathname.lastIndexOf('/') + 1)}`;

        if (contentType.includes('text/html')) {
            let html = Buffer.from(upstream.data).toString('utf-8');
            html = html
                .replace(
                    /((?:src|href|action|data-src)=["'])(https?:\/\/[^"']+)(["'])/gi,
                    (_m, pre, url, post) => `${pre}/proxy?url=${encodeURIComponent(url)}${post}`,
                )
                .replace(
                    /((?:src|href)=["'])(\/[^"']+)(["'])/gi,
                    (_m, pre, path, post) => `${pre}/proxy?url=${encodeURIComponent(baseOrigin + path)}${post}`,
                )
                .replace(
                    /((?:src|href)=["'])(?!https?:\/\/|\/|data:|javascript:|#)([^"']+)(["'])/gi,
                    (_m, pre, path, post) => `${pre}/proxy?url=${encodeURIComponent(basePath + path)}${post}`,
                )
                .replace(/document\.domain\s*=\s*["'][^"']*["']/g, '/* patched */');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        } else if (contentType.includes('javascript') || contentType.includes('text/plain')) {
            let js = Buffer.from(upstream.data).toString('utf-8');
            js = js.replace(/document\.domain\s*=\s*["'][^"']*["']/g, '/* patched */');
            res.setHeader('Content-Type', contentType);
            res.send(js);
        } else if (target.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('x-mpegURL')) {
            let m3u8 = Buffer.from(upstream.data).toString('utf-8');
            m3u8 = m3u8.split('\n').map(line => {
                const trimmed = line.trim();
                // If it's empty or a comment, leave it unchanged
                if (!trimmed || trimmed.startsWith('#')) return line;
                
                // If it's already an absolute URL
                if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                    return `/proxy?url=${encodeURIComponent(trimmed)}`;
                }
                
                // If it's a relative URL, resolve it against the current M3U8 folder path
                // "basePath" is already declared above as the folder of the M3U8 file
                return `/proxy?url=${encodeURIComponent(basePath + trimmed)}`;
            }).join('\n');
            res.setHeader('Content-Type', contentType);
            res.send(m3u8);
        } else {
            res.send(Buffer.from(upstream.data));
        }
    } catch (err: any) {
        const status = err?.response?.status;
        if (status && status < 500) {
            // upstream client error (404, 403, etc) — pass through silently
            res.status(status).send('');
        } else {
            console.error('[proxy]', err.message);
            res.status(502).send('Proxy error: ' + err.message);
        }
    }
}

export const proxyHandler = async (req: Request, res: Response): Promise<void> => {
    let target = req.query.url as string;
    if (!target) { res.status(400).send('Missing url param'); return; }

    if (target.includes('playeriframe.sbs/proxy?url=') || target.includes('playeriframe.lol/proxy?url=')) {
        try {
            const innerUrlStr = target.split('proxy?url=')[1];
            if (innerUrlStr) {
                 target = decodeURIComponent(innerUrlStr);
            }
        } catch (e) {}
    }

    await fetchAndProxy(target, req, res);
};
