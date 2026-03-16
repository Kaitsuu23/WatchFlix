import * as cheerio from 'cheerio';
import { CheerioAPI } from 'cheerio';
import { AnyNode } from 'domhandler';
import { AxiosResponse } from 'axios';
import { Request } from 'express';
import { ISeasonsList, IPaginatedResult, ISeries, ISeriesDetails } from '@/types';

/**
 * Scrape series asynchronously
 */
export const scrapeSeries = async (
    req: Request,
    res: AxiosResponse
): Promise<IPaginatedResult<ISeries>> => {
    const $: CheerioAPI = cheerio.load(res.data);
    const payload: ISeries[] = [];
    const {
        headers: { host },
        protocol,
    } = req;

    $('div.gallery-grid > article').each((_i: number, el: AnyNode) => {
        const obj = {} as ISeries;
        const genres: string[] = [];

        const genreContent =
            $(el).find('meta[itemprop="genre"]').attr('content') ?? '';
        genreContent.split(',').forEach((g: string) => {
            const slug = g.trim().toLowerCase().replace(/\s+/g, '-');
            if (slug) genres.push(slug);
        });

        const href = $(el).find('figure > a').attr('href') ?? '';
        const seriesId = href.replace(/^\//, '').replace(/\/$/, '');

        const episodeText = $(el)
            .find('span.episode > strong')
            .text()
            .trim();

        obj['_id'] = seriesId;
        obj['title'] =
            $(el)
                .find('figure > a > div.poster > picture > img')
                .attr('alt') ?? '';
        obj['type'] = 'series';
        obj['posterImg'] =
            $(el)
                .find('figure > a > div.poster > picture > img')
                .attr('src') ?? '';
        obj['episode'] = Number(episodeText) || 0;
        obj['rating'] = $(el)
            .find('span.rating > span[itemprop="ratingValue"]')
            .text()
            .trim();
        obj['url'] = `${protocol}://${host}/series/${seriesId}`;
        obj['genres'] = genres;

        if (seriesId) payload.push(obj);
    });

    // scrape total pages: try "Halaman X dari Y" text first (lk21), fallback to max /page/N link (nontondrama)
    let totalPages = 1;
    const bodyText = $.root().text();
    const textMatch = bodyText.match(/dari\s+(\d+)\s+total/i);
    if (textMatch) {
        totalPages = Number(textMatch[1]);
    } else {
        $('a[href*="/page/"]').each((_i, el) => {
            const m = $(el).attr('href')?.match(/\/page\/(\d+)/);
            if (m) totalPages = Math.max(totalPages, Number(m[1]));
        });
    }

    const currentPage = Number(req.query.page) || 1;

    return { results: payload, totalPages, currentPage };
};

/**
 * Scrape series details asynchronously
 */
export const scrapeSeriesDetails = async (
    req: Request,
    res: AxiosResponse
): Promise<ISeriesDetails> => {
    const { originalUrl } = req;

    const $: CheerioAPI = cheerio.load(res.data);
    const obj = {} as ISeriesDetails;

    const genres: string[] = [];
    const directors: string[] = [];
    const countries: string[] = [];
    const casts: string[] = [];

    const seriesId = originalUrl.split('/').reverse()[0];
    obj['_id'] = seriesId;

    obj['title'] = $('h1')
        .first()
        .text()
        .replace(/^Nonton\s+/i, '')
        .replace(/\s+Sub Indo.*$/i, '')
        .trim();
    obj['type'] = 'series';
    obj['posterImg'] =
        $('div.detail img[itemprop="image"]').attr('src') ?? '';
    obj['rating'] = $('div.info-tag > span').first().find('strong').text().trim();
    obj['duration'] = '';

    $('div.info-tag > span').each((_i: number, el: AnyNode) => {
        const text = $(el).text().trim();
        if (/\d+h|\d+m/.test(text)) obj['duration'] = text;
    });

    obj['synopsis'] = $('div.synopsis').text().trim();
    obj['status'] = '';

    $('div.detail > p').each((_i: number, el: AnyNode) => {
        const label = $(el).find('span').first().text().toLowerCase().trim();
        $(el).find('span').first().remove();

        /* eslint-disable */
        switch (label) {
            case 'sutradara:':
                $(el)
                    .find('a')
                    .each((_i: number, a: AnyNode) => void directors.push($(a).text().trim()));
                break;
            case 'bintang film:':
                $(el)
                    .find('a')
                    .each((_i: number, a: AnyNode) => void casts.push($(a).text().trim()));
                break;
            case 'negara:':
                $(el)
                    .find('a')
                    .each((_i: number, a: AnyNode) => void countries.push($(a).text().trim()));
                break;
            case 'release:':
                obj['releaseDate'] = $(el).text().trim();
                break;
        }
        /* eslint-enable */
    });

    $('div.tag-list > span.tag > a[href^="/genre/"]').each(
        (_i: number, el: AnyNode) => {
            genres.push($(el).text().trim());
        }
    );

    obj['trailerUrl'] =
        $('div.trailer-series iframe').attr('src') ?? '';
    obj['genres'] = genres;
    obj['directors'] = directors;
    obj['countries'] = countries;
    obj['casts'] = casts;

    // seasons: parse inline JSON episode data from script tags
    const seasons: ISeasonsList[] = [];
    const seasonMap = new Map<number, { ep: number; slug: string }[]>();

    $('script').each((_i: number, el: AnyNode) => {
        const content = $(el).html() || '';
        const jsonMatch = content.match(/\{"\d+":\s*\[[\s\S]*?\]\s*(?:,\s*"\d+":\s*\[[\s\S]*?\]\s*)*\}/);
        if (jsonMatch) {
            try {
                const data = JSON.parse(jsonMatch[0]) as Record<string, Array<{ s: number; episode_no: number; slug: string }>>;
                Object.values(data).forEach(eps => {
                    eps.forEach(ep => {
                        const s = Number(ep.s);
                        if (!seasonMap.has(s)) seasonMap.set(s, []);
                        seasonMap.get(s)!.push({ ep: Number(ep.episode_no), slug: ep.slug });
                    });
                });
            } catch (_) {}
        }
    });

    // fallback: parse from href links
    if (seasonMap.size === 0) {
        $('a[href*="-episode-"]').each((_i: number, el: AnyNode) => {
            const href = $(el).attr('href') ?? '';
            const match = href.match(/-season-(\d+)-episode-(\d+)/);
            if (match) {
                const s = Number(match[1]);
                const ep = Number(match[2]);
                const slug = href.replace(/^\//, '').replace(/\/$/, '');
                if (!seasonMap.has(s)) seasonMap.set(s, []);
                const existing = seasonMap.get(s)!;
                if (!existing.find(e => e.ep === ep)) existing.push({ ep, slug });
            }
        });
    }

    seasonMap.forEach((episodes, season) => {
        episodes.sort((a, b) => a.ep - b.ep);
        seasons.push({ season, totalEpisodes: episodes.length, episodes });
    });

    seasons.sort((a, b) => a.season - b.season);
    obj['seasons'] = seasons;

    return obj;
};
