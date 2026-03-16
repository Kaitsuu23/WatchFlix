import axios from 'axios';
import { NextFunction as Next, Request, Response } from 'express';

type TController = (req: Request, res: Response, next?: Next) => Promise<void>;

const SEARCH_API = 'https://gudangvape.com/search.php';
const THUMBNAIL_BASE = 'https://static-jpg.lk21.party/wp-content/uploads/';

/**
 * Controller for /search/:title route
 * Uses the internal JSON search API
 */
export const searchedMoviesOrSeries: TController = async (req, res) => {
    try {
        const { title = '' } = req.params;
        const { page = 1 } = req.query;
        const {
            protocol,
            headers: { host },
        } = req;

        const response = await axios.get(SEARCH_API, {
            params: { s: title, page },
            headers: {
                Referer: process.env.LK21_URL ?? 'https://tv9.lk21official.cc',
                Accept: 'application/json',
            },
        });

        const items: any[] = response.data?.data ?? [];

        const payload = items.map((item) => {
            const type: 'movie' | 'series' =
                item.episode > 0 || item.season > 0 ? 'series' : 'movie';

            return {
                _id: item.slug,
                title: item.title,
                type,
                posterImg: item.poster
                    ? `${THUMBNAIL_BASE}${item.poster}`
                    : '',
                rating: String(item.rating ?? ''),
                url: `${protocol}://${host}/${type}/${item.slug}`,
                qualityResolution: item.quality ?? '',
                genres: [],
                episode: item.episode ?? 0,
                directors: [],
                casts: [],
            };
        });

        res.status(200).json(payload);
    } catch (err) {
        console.error(err);
        res.status(400).json(null);
    }
};
