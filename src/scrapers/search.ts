import * as cheerio from 'cheerio';
import { CheerioAPI } from 'cheerio';
import { AxiosResponse } from 'axios';
import { Request } from 'express';
import { ISearchedMoviesOrSeries } from '@/types';

/**
 * Scrape searched movies or series
 */
export const scrapeSearchedMoviesOrSeries = async (
    req: Request,
    res: AxiosResponse
): Promise<ISearchedMoviesOrSeries[]> => {
    const $: CheerioAPI = cheerio.load(res.data);
    const payload: ISearchedMoviesOrSeries[] = [];
    const {
        headers: { host },
        protocol,
    } = req;

    $('div.gallery-grid > article').each((_i: number, el: cheerio.Element) => {
        const obj = {} as ISearchedMoviesOrSeries;
        const genres: string[] = [];

        const genreContent =
            $(el).find('meta[itemprop="genre"]').attr('content') ?? '';
        genreContent.split(',').forEach((g: string) => {
            const slug = g.trim().toLowerCase().replace(/\s+/g, '-');
            if (slug) genres.push(slug);
        });

        const href = $(el).find('figure > a').attr('href') ?? '';
        const id = href.replace(/^\//, '').replace(/\/$/, '');

        const hasEpisode = $(el).find('span.episode').length > 0;
        const type: 'movie' | 'series' = hasEpisode ? 'series' : 'movie';

        obj['_id'] = id;
        obj['title'] =
            $(el)
                .find('figure > a > div.poster > picture > img')
                .attr('alt') ?? '';
        obj['type'] = type;
        obj['posterImg'] =
            $(el)
                .find('figure > a > div.poster > picture > img')
                .attr('src') ?? '';
        obj['url'] = `${protocol}://${host}/${type}/${id}`;
        obj['genres'] = genres;
        obj['directors'] = [];
        obj['casts'] = [];

        if (id) payload.push(obj);
    });

    return payload;
};
