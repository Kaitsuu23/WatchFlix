import * as cheerio from 'cheerio';
import { CheerioAPI } from 'cheerio';
import { AxiosResponse } from 'axios';
import { Request } from 'express';
import { ISetOfYears } from '@/types';

/**
 * Scrape a set of release years asynchronously
 */
export const scrapeSetOfYears = async (
    req: Request,
    res: AxiosResponse
): Promise<ISetOfYears[]> => {
    const $: CheerioAPI = cheerio.load(res.data);
    const payload: ISetOfYears[] = [];
    const {
        protocol,
        headers: { host },
    } = req;

    $('select[name="tahun"] > option').each(
        (_i: number, el: cheerio.Element) => {
            const value = $(el).attr('value') ?? '';

            if (!value || value === '0') return;

            const obj = {} as ISetOfYears;
            obj['parameter'] = value;
            obj['numberOfContents'] = 0;
            obj['url'] = `${protocol}://${host}/years/${value}`;

            payload.push(obj);
        }
    );

    return payload;
};
