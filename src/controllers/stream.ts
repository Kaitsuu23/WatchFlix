import axios from 'axios';
import { NextFunction as Next, Request, Response } from 'express';
import { scrapeStreamSources } from '@/scrapers/stream';
import { getImdbId } from '@/utils/tmdb';
import { IStreamSources } from '@/types';

type TController = (req: Request, res: Response, next?: Next) => Promise<void>;

/**
 * Build extra stream sources from external providers using IMDb ID.
 */
function buildExternalStreams(imdbId: string, tmdbId: string, type: 'movie' | 'series', season?: number, episode?: number): IStreamSources[] {
    const sources: IStreamSources[] = [];

    if (type === 'movie') {
        sources.push({ provider: 'VidSrc', url: `https://vidsrc.to/embed/movie/${imdbId}`, resolutions: [] });
        sources.push({ provider: 'VSEmbed', url: `https://vsembed.ru/embed/movie/${imdbId}/`, resolutions: [] });
        sources.push({ provider: '2Embed', url: `https://www.2embed.cc/embed/${imdbId}`, resolutions: [] });
        sources.push({ provider: 'SuperEmbed', url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`, resolutions: [] });
    } else {
        const s = season ?? 1;
        const e = episode ?? 1;
        sources.push({ provider: 'VidSrc', url: `https://vidsrc.to/embed/tv/${imdbId}/${s}/${e}`, resolutions: [] });
        sources.push({ provider: 'VSEmbed', url: `https://vsembed.ru/embed/tv/${imdbId}/${s}/${e}/`, resolutions: [] });
        sources.push({ provider: '2Embed', url: `https://www.2embed.cc/embedtv/${imdbId}&s=${s}&e=${e}`, resolutions: [] });
        sources.push({ provider: 'SuperEmbed', url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${s}&e=${e}`, resolutions: [] });
    }

    return sources;
}

/**
 * Extract title and year from a movie/series detail page.
 */
async function fetchTitleAndYear(url: string): Promise<{ title: string; year: string }> {
    const { data } = await axios.get(url);
    const cheerio = await import('cheerio');
    const $ = cheerio.load(data);

    const rawTitle = $('h1').first().text();
    const title = rawTitle
        .replace(/^Nonton\s+/i, '')
        .replace(/\s+Sub Indo.*$/i, '')
        .replace(/\s*\(\d{4}\)\s*$/, '') // strip trailing (year)
        .trim();

    // grab year from release info or anywhere on page
    const pageText = $.root().text();
    const yearMatch = pageText.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch?.[0] ?? '';

    console.log(`[tmdb] title="${title}" year="${year}"`);
    return { title, year };
}

/**
 * Controller for `/movies/:movieId/streams`
 */
export const streamMovie: TController = async (req, res) => {
    try {
        const movieId = req.originalUrl.split('/').reverse()[1];

        const axiosRequest = await axios.get(`${process.env.LK21_URL}/${movieId}`);
        const lk21Streams = await scrapeStreamSources(req, axiosRequest);

        // Lookup IMDb ID via TMDB
        let externalStreams: IStreamSources[] = [];
        try {
            const { title, year } = await fetchTitleAndYear(`${process.env.LK21_URL}/${movieId}`);
            const { imdbId, tmdbId } = await getImdbId(title, year, 'movie');
            console.log(`[tmdb] imdbId=${imdbId} tmdbId=${tmdbId}`);
            if (imdbId && tmdbId) externalStreams = buildExternalStreams(imdbId, tmdbId, 'movie');
        } catch (e) {
            console.warn('[stream] TMDB lookup failed:', (e as Error).message);
        }

        res.status(200).json([...lk21Streams, ...externalStreams]);
    } catch (err) {
        console.error(err);
        res.status(400).json(null);
    }
};

/**
 * Controller for `/series/:seriesId/streams`
 */
export const streamSeries: TController = async (req, res) => {
    try {
        const { season = 1, episode = 1 } = req.query;
        const _ids = req.originalUrl.split('/').reverse()[1].split('-');
        const year = _ids.pop();
        const seriesId = _ids.join('-');

        const axiosRequest = await axios.get(
            `${process.env.ND_URL}/${seriesId}-season-${season}-episode-${episode}-${year}`,
        );
        const lk21Streams = await scrapeStreamSources(req, axiosRequest);

        // Lookup IMDb ID via TMDB
        let externalStreams: IStreamSources[] = [];
        try {
            const { title } = await fetchTitleAndYear(`${process.env.ND_URL}/${seriesId}-${year}`);
            const { imdbId, tmdbId } = await getImdbId(title, year, 'series');
            if (imdbId && tmdbId) externalStreams = buildExternalStreams(imdbId, tmdbId, 'series', Number(season), Number(episode));
        } catch (e) {
            console.warn('[stream] TMDB lookup failed:', (e as Error).message);
        }

        res.status(200).json([...lk21Streams, ...externalStreams]);
    } catch (err) {
        console.error(err);
        res.status(400).json(null);
    }
};
