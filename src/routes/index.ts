import { Router, IRouter } from 'express';
import { streamSeries, streamMovie } from '@/controllers/stream';
import { moviesByGenre, setOfGenres } from '@/controllers/genre';
import { moviesByYear, setOfYears } from '@/controllers/year';
import { searchedMoviesOrSeries } from '@/controllers/search';
import { moviesByCountry, setOfCountries } from '@/controllers/country';
import { proxyHandler } from '@/controllers/proxy';

import {
    latestMovies,
    movieDetails,
    popularMovies,
    recentReleaseMovies,
    topRatedMovies,
    filterContent,
} from '../controllers/movie';

import {
    latestSeries,
    popularSeries,
    recentReleaseSeries,
    seriesDetails,
    topRatedSeries,
    ongoingSeries,
    completeSeries,
    westSeries,
    asianSeries,
} from '../controllers/series';

import { downloadMovie, downloadSeries } from '@/controllers/download';

const router: IRouter = Router();



router.get('/proxy', proxyHandler);

// ── Movies ──
router.get('/movies', latestMovies);
router.get('/movies/popular', popularMovies);
router.get('/movies/top-rated', topRatedMovies);
router.get('/movies/recent', recentReleaseMovies);
router.get('/movies/:id/streams', streamMovie);
router.get('/movies/:id/download', downloadMovie);
router.get('/movies/:id', movieDetails);

// ── Filter ──
router.get('/api/filter', filterContent);

// ── Genres / Countries / Years ──
router.get('/genres', setOfGenres);
router.get('/genres/:genre', moviesByGenre);
router.get('/countries', setOfCountries);
router.get('/countries/:country', moviesByCountry);
router.get('/years', setOfYears);
router.get('/years/:year', moviesByYear);

// ── Series ──
router.get('/series', latestSeries);
router.get('/series/popular', popularSeries);
router.get('/series/top-rated', topRatedSeries);
router.get('/series/recent', recentReleaseSeries);
router.get('/series/ongoing', ongoingSeries);
router.get('/series/complete', completeSeries);
router.get('/series/west', westSeries);
router.get('/series/asian', asianSeries);
router.get('/series/:id/streams', streamSeries);
router.get('/series/:id/downloads', downloadSeries);
router.get('/series/:id', seriesDetails);

// ── Search ──
router.get('/api/search/:title', searchedMoviesOrSeries);

export default router;
