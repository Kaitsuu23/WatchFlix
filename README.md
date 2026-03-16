# WatchFlix

![cover-banner](docs/img/cover-banner.jpg)

WatchFlix is a movie and series streaming web app with Indonesian subtitles support. Stream thousands of movies, animations, and series from around the world for free.

## Table of Contents

-   [Getting Started](#getting-started)
    -   [Installation](#installation)
    -   [Environment Variables](#environment-variables)
-   [Reference](#reference)
    -   [List of Endpoints](#list-of-endpoints)
    -   [Pagination](#pagination)
-   [License](#license)

## Getting Started

### Installation

**Step 1:** Clone this repository.

```bash
git clone https://github.com/Kaitsuu23/WatchFlix.git
```

**Step 2:** Rename the `.env.example` file to `.env` and complete the required [environment variables](#environment-variables).

**Step 3:** Install dependencies.

```bash
npm install
```

**Step 4:** Build the project.

```bash
npm run prepare && npm run build
```

**Step 5:** Run the project.

```bash
npm start
```

### Environment Variables

```bash
# LK21 (LayarKaca21) URL
LK21_URL = https://tv.lk21official.live

# NontonDrama URL
ND_URL = https://tv.nontondrama.lol
```

## Reference

### List of Endpoints

| Request                            | Response                  | Pagination |
| :--------------------------------- | :------------------------ | :--------: |
| `GET /movies`                      | Recent upload movies      |     √      |
| `GET /movies/{movieId}`            | The movie details         |     -      |
| `GET /popular/movies`              | Popular movies            |     √      |
|                                    |                           |            |
| `GET /series`                      | Recent upload series      |     √      |
| `GET /series/{seriesId}`           | The series details        |     -      |
| `GET /popular/series`              | Popular series            |     √      |
|                                    |                           |            |
| `GET /search/{movieOrSeriesTitle}` | Searched movies or series |     -      |
|                                    |                           |            |
| `GET /genres`                      | A set of genres           |     -      |
| `GET /countries`                   | A set of countries        |     -      |
| `GET /years`                       | A set of years            |     -      |

See more [endpoints](/docs/endpoints.md).

### Pagination

```bash
GET /popular/movies?page=5
```

## License

Distributed under the [MIT License](/LICENSE).

[(Back to Top)](#watchflix)
