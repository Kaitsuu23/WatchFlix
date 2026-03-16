import axios from 'axios';

const TMDB_BASE = 'https://api.themoviedb.org/3';

function apiKey() {
    const key = process.env.TMDB_API_KEY;
    if (!key) throw new Error('TMDB_API_KEY not set in .env');
    return key;
}

/**
 * Search TMDB and return the IMDb ID for a movie or TV show.
 * @param title  - Film/series title
 * @param year   - Release year (optional but improves accuracy)
 * @param type   - 'movie' | 'series'
 */
export async function getImdbId(
    title: string,
    year?: string,
    type: 'movie' | 'series' = 'movie',
): Promise<{ imdbId: string | null; tmdbId: string | null }> {
    const endpoint = type === 'series' ? 'tv' : 'movie';

    const { data } = await axios.get(`${TMDB_BASE}/search/${endpoint}`, {
        params: {
            api_key: apiKey(),
            query: title,
            ...(year ? { year } : {}),
        },
    });

    const result = data.results?.[0];
    if (!result) return { imdbId: null, tmdbId: null };

    const tmdbId = String(result.id);

    // Fetch external IDs to get IMDb ID
    const { data: ext } = await axios.get(
        `${TMDB_BASE}/${endpoint}/${result.id}/external_ids`,
        { params: { api_key: apiKey() } },
    );

    return { imdbId: ext.imdb_id ?? null, tmdbId };
}
