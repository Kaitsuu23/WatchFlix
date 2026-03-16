import * as cheerio from 'cheerio';
import { CheerioAPI } from 'cheerio';
import { AxiosResponse } from 'axios';
import { Request } from 'express';
import { ISetOfGenres } from '@/types';

/**
 * Scrape a set of genres asynchronously
 */
export const scrapeSetOfGenres = async (
    req: Request,
    res: AxiosResponse
): Promise<ISetOfGenres[]> => {
    const $: CheerioAPI = cheerio.load(res.data);
    const payload: ISetOfGenres[] = [];
    const {
        headers: { host },
        protocol,
    } = req;

    $('select[name="genre1"] > option').each(
        (_i: number, el: cheerio.Element) => {
            const value = $(el).attr('value') ?? '';
            const name = $(el).text().trim();

            if (!value) return;

            const obj = {} as ISetOfGenres;
            obj['parameter'] = value;
            obj['name'] = name;
            obj['numberOfContents'] = 0;
            obj['url'] = `${protocol}://${host}/genres/${value}`;

            payload.push(obj);
        }
    );

    return payload;
};
