import { NextFunction as Next, Request, Response } from 'express';

type TController = (req: Request, res: Response, next?: Next) => Promise<void>;

const DL_BASE = 'https://dl.lk21.party';

/**
 * Controller for `/movies/:id/download`
 * Returns the direct download page URL on dl.lk21.party
 */
export const downloadMovie: TController = async (req, res) => {
    try {
        const { id } = req.params;
        res.status(200).json({ url: `${DL_BASE}/${id}/` });
    } catch (err) {
        res.status(400).json(null);
    }
};

/**
 * Controller for `/series/:id/downloads`
 * Returns the direct download page URL for a specific episode
 */
export const downloadSeries: TController = async (req, res) => {
    try {
        const { id } = req.params;
        const { season = 1, episode = 1 } = req.query;

        // strip year from id: "one-piece-2023" → base="one-piece", year="2023"
        const parts = id.split('-');
        const year = parts[parts.length - 1];
        const base = parts.slice(0, -1).join('-');

        const slug = `${base}-season-${season}-episode-${episode}-${year}`;
        res.status(200).json({ url: `${DL_BASE}/${slug}/` });
    } catch (err) {
        res.status(400).json(null);
    }
};
