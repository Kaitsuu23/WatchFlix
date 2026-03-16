import * as cheerio from 'cheerio';
import { CheerioAPI } from 'cheerio';
import { AxiosResponse } from 'axios';
import { Request } from 'express';
import { ISetOfCountries } from '@/types';

/**
 * Scrape a set of countries asynchronously
 */
export const scrapeSetOfCountries = async (
    req: Request,
    res: AxiosResponse
): Promise<ISetOfCountries[]> => {
    const $: CheerioAPI = cheerio.load(res.data);
    const payload: ISetOfCountries[] = [];
    const {
        protocol,
        headers: { host },
    } = req;

    $('select[name="country"] > option').each(
        (_i: number, el: cheerio.Element) => {
            const value = $(el).attr('value') ?? '';
            const name = $(el).text().trim();

            if (!value) return;

            const obj = {} as ISetOfCountries;
            obj['parameter'] = value;
            obj['name'] = name;
            obj['numberOfContents'] = 0;
            obj['url'] = `${protocol}://${host}/countries/${value}`;

            payload.push(obj);
        }
    );

    return payload;
};
