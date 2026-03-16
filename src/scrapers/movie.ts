import { Request } from 'express';
import * as cheerio from 'cheerio';
import { CheerioAPI } from 'cheerio';
import { AnyNode } from 'domhandler';
import { AxiosResponse } from 'axios';
import { IMovies, IMovieDetails, IPaginatedResult } from '@/types';

/**
 * Scrape movies asynchronously
 */
export const scrapeMovies = async (
    req: Request,
    res: AxiosResponse
): Promise<IPaginatedResult<IMovies>> => {
    const $: CheerioAPI = cheerio.load(res.data);
    const payload: IMovies[] = [];
    const {
        protocol,
        headers: { host },
    } = req;

    $('div.gallery-grid > article').each((_i: number, el: AnyNode) => {
        const obj = {} as IMovies;
        const genres: string[] = [];

        const genreContent =
            $(el).find('meta[itemprop="genre"]').attr('content') ?? '';
        genreContent.split(',').forEach((g: string) => {
            const slug = g.trim().toLowerCase().replace(/\s+/g, '-');
            if (slug) genres.push(slug);
        });

        const href = $(el).find('figure > a').attr('href') ?? '';
        const movieId = href.replace(/^\//, '').replace(/\/$/, '');

        obj['_id'] = movieId;
        obj['title'] =
            $(el)
                .find('figure > a > div.poster > picture > img')
                .attr('alt') ?? '';
        obj['type'] = 'movie';
        obj['posterImg'] =
            $(el)
                .find('figure > a > div.poster > picture > img')
                .attr('src') ?? '';
        obj['rating'] = $(el)
            .find('span.rating > span[itemprop="ratingValue"]')
            .text()
            .trim();
        obj['url'] = `${protocol}://${host}/movies/${movieId}`;
        obj['qualityResolution'] = $(el).find('span.label').text().trim();
        obj['genres'] = genres;

        if (movieId) payload.push(obj);
    });

    // scrape total pages from pagination text e.g. "Halaman 1 dari 1135 total"
    let totalPages = 1;
    const paginationText = $('*').filter((_i, el) => {
        return /halaman\s+\d+\s+dari\s+\d+/i.test($(el).text());
    }).first().text();
    const match = paginationText.match(/dari\s+(\d+)/i);
    if (match) totalPages = Number(match[1]);

    const currentPage = Number(req.query.page) || 1;

    return { results: payload, totalPages, currentPage };
};

/**
 * Scrape movie details asynchronously
 */
export const scrapeMovieDetails = async (
    req: Request,
    res: AxiosResponse
): Promise<IMovieDetails> => {
    const { originalUrl } = req;

    const $: CheerioAPI = cheerio.load(res.data);
    const obj = {} as IMovieDetails;

    const genres: string[] = [];
    const directors: string[] = [];
    const countries: string[] = [];
    const casts: string[] = [];

    const movieId = originalUrl.split('/').reverse()[0];
    obj['_id'] = movieId;

    obj['title'] = $('h1')
        .first()
        .text()
        .replace(/^Nonton\s+/i, '')
        .replace(/\s+Sub Indo.*$/i, '')
        .trim();
    obj['type'] = 'movie';
    obj['posterImg'] =
        $('div.detail img[itemprop="image"]').attr('src') ?? '';
    obj['rating'] = $('div.info-tag > span').first().find('strong').text().trim();
    obj['quality'] = '';
    obj['duration'] = '';

    $('div.info-tag > span').each((_i: number, el: AnyNode) => {
        const text = $(el).text().trim();
        if (/\d+h|\d+m/.test(text)) obj['duration'] = text;
        if (/^(HD|BluRay|CAM|TS|WEB-DL|WEBRip|DVDRip)/i.test(text))
            obj['quality'] = text;
    });

    obj['synopsis'] = $('div.synopsis').text().trim();

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

    obj['trailerUrl'] = $('a.yt-lightbox').attr('href') ?? '';
    obj['genres'] = genres;
    obj['directors'] = directors;
    obj['countries'] = countries;
    obj['casts'] = casts;

    return obj;
};
