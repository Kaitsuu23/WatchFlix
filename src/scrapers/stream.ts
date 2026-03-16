import { Request } from 'express';
import * as cheerio from 'cheerio';
import { CheerioAPI } from 'cheerio';
import { AxiosResponse } from 'axios';
import { IStreamSources } from '@/types';

/**
 * Scrape stream sources asynchronously
 */
export const scrapeStreamSources = async (
    req: Request,
    res: AxiosResponse
): Promise<IStreamSources[]> => {
    const $: CheerioAPI = cheerio.load(res.data);
    const payload: IStreamSources[] = [];

    $('ul.player-list > li > a').each((_i: number, el: cheerio.Element) => {
        const obj = {} as IStreamSources;

        obj['provider'] = $(el).text().trim();
        obj['url'] = $(el).attr('href') ?? $(el).attr('data-url') ?? '';
        obj['resolutions'] = [];

        payload.push(obj);
    });

    // fallback: select#player-select options
    if (payload.length === 0) {
        $('select#player-select > option').each(
            (_i: number, el: cheerio.Element) => {
                const obj = {} as IStreamSources;
                const text = $(el)
                    .text()
                    .replace(/^GANTI PLAYER\s*/i, '')
                    .trim();

                obj['provider'] = text;
                obj['url'] = $(el).attr('value') ?? '';
                obj['resolutions'] = [];

                if (obj['url']) payload.push(obj);
            }
        );
    }

    return payload;
};
