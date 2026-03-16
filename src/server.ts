import dotenv from 'dotenv';

dotenv.config();

import express, { Application, Request, Response } from 'express';
import path from 'path';
import axios from 'axios';
import morgan from 'morgan';
import cors from 'cors';
import routes from '@/routes';

const app: Application = express();

// middlewares
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(morgan('tiny'));
app.use(cors({ origin: '*' }));

// Forward Cloudflare challenge, API requests, and proxy static assets BEFORE static middleware
app.all(['/cdn-cgi/*', '/*.php', '/js/*', '/css/*', '/fonts/*', '/ajax/*', '/assets/*', '/images/*'], async (req: Request, res: Response, next) => {
    const referer = req.headers.referer || '';
    const fromProxy = referer.includes('/proxy?url=');
    const isStrictProxy = req.path.includes('/cdn-cgi/') || req.path.endsWith('.php');

    // If it's a static asset (/js/, /css/) but doesn't come from proxy, let express.static handle it
    if (!isStrictProxy && !fromProxy) {
        return next();
    }

    let forwardDomain = 'https://cloud.hownetwork.xyz';
    let targetUrlString = '';
    
    if (fromProxy) {
        try {
            const urlMatch = referer.match(/\/proxy\?url=([^&]+)/);
            if (urlMatch && urlMatch[1]) {
                targetUrlString = decodeURIComponent(urlMatch[1]);
                while (targetUrlString.includes('proxy?url=')) {
                    const m = targetUrlString.match(/proxy\?url=([^&]+)/);
                    if (m && m[1]) targetUrlString = decodeURIComponent(m[1]);
                    else break;
                }
                const proxyUrl = new URL(targetUrlString);
                forwardDomain = `${proxyUrl.protocol}//${proxyUrl.host}`;
            }
        } catch (e) {}
    }

    let qs = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
    
    // Fix for api2.php?id=null when player.js fails to parse encoded URL
    if (req.path.includes('.php') && qs.includes('id=null') && targetUrlString) {
        try {
            const proxyUrl = new URL(targetUrlString);
            const actualId = proxyUrl.searchParams.get('id');
            if (actualId) {
                qs = qs.replace('id=null', `id=${actualId}`);
            }
        } catch (e) {}
    }

    const target = `${forwardDomain}${req.path}${qs}`;
    
    try {
        const isUrlEncoded = req.headers['content-type']?.includes('application/x-www-form-urlencoded');
        const reqData = isUrlEncoded ? new URLSearchParams(req.body).toString() : req.body;

        const proxyHeaders: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
            'Referer': `${forwardDomain}/`,
            'Origin': forwardDomain,
        };
        if (req.headers['content-type']) {
            proxyHeaders['Content-Type'] = req.headers['content-type'] as string;
        }

        const resp = await axios({
            method: req.method,
            url: target,
            data: reqData,
            headers: proxyHeaders,
            responseType: 'arraybuffer',
            validateStatus: () => true,
        });
        
        // Pass essential response headers back
        if (resp.headers['content-type']) {
            res.setHeader('Content-Type', resp.headers['content-type']);
        }
        
        // If the response is json (like from api2.php), rewrite absolute URLs to go through proxy
        const contentType = resp.headers['content-type'] || '';
        if (contentType.includes('application/json') || req.path.endsWith('.php')) {
            try {
                let jsonStr = Buffer.from(resp.data).toString('utf-8');
                jsonStr = jsonStr.replace(
                    /https?:\/\/[^"'\s]+/gi,
                    (url) => `/proxy?url=${encodeURIComponent(url)}`
                );
                return res.status(resp.status).send(Buffer.from(jsonStr));
            } catch (e) {}
        }

        res.status(resp.status).send(Buffer.from(resp.data));
    } catch {
        res.status(502).send('');
    }
});

app.use(express.static('public'));

// Clean URLs
const htmlPages = ['search'];
htmlPages.forEach(page => {
    app.get(`/${page}`, (_req: Request, res: Response) => {
        res.sendFile(path.resolve('public', `${page}.html`));
    });
});
app.get('/search/:query', (_req: Request, res: Response) => res.sendFile(path.resolve('public', 'search.html')));

app.get('/player/:id/:type', (_req: Request, res: Response) => res.sendFile(path.resolve('public', 'player.html')));
app.get('/player/:id', (_req: Request, res: Response) => res.sendFile(path.resolve('public', 'player.html')));
app.get('/player', (_req: Request, res: Response) => res.sendFile(path.resolve('public', 'player.html')));

// Clean episode URLs: /slug-season-1-episode-1-year
app.get(/^\/.+-season-\d+-episode-\d+-.+$/, (_req: Request, res: Response) => res.sendFile(path.resolve('public', 'player.html')));

app.get('/popular', (_req: Request, res: Response) => res.sendFile(path.resolve('public', 'popular.html')));
app.get('/top-rated', (_req: Request, res: Response) => res.sendFile(path.resolve('public', 'top-rated.html')));
app.get('/drama/:slug', (_req: Request, res: Response) => res.sendFile(path.resolve('public', 'drama.html')));
app.get('/drama', (_req: Request, res: Response) => res.sendFile(path.resolve('public', 'drama.html')));

// Filter with clean path segments
app.get('/filter', (_req: Request, res: Response) => res.sendFile(path.resolve('public', 'filter.html')));
app.get('/filter/*', (_req: Request, res: Response) => res.sendFile(path.resolve('public', 'filter.html')));

app.use(routes);

app.get('/api', (req: Request, res: Response) => {
    res.status(200).json({
        message: 'Unofficial LK21 (LayarKaca21) and NontonDrama APIs',
        data: {
            LK21_URL: process.env.LK21_URL,
            ND_URL: process.env.ND_URL,
        },
    });
});

export default app;
