# Museum Rankings

A museum discovery and personal ranking app for Smithsonian museums in Washington, DC. This is an independent concept project and is not affiliated with the Smithsonian Institution.

## Try the app

Open `index.html` in a web browser. Search and filter the directory, save museums to **Want to visit**, log visits, then compare and reorder your personal ranking. Each comparison asks you to choose; if two visits feel equal, pick either and adjust with the arrows.

Your profile, saved list, visits, notes, and ranking are stored in this browser on this device. They do not sync to other devices. Clearing this browser's site data will erase them.

## How the code is organized

One browser app, no framework or server. Scripts load in this order (see `index.html`):

| File | Role | Story |
|---|---|---|
| `assets/museums.js` | Catalog: the 13 pilot institutions | all |
| `assets/sample-friends.js` | Invented sample friends, labelled "Sample" in the UI | Log & remember |
| `assets/filters.js` | Pure rules: category, status, location and title search | Find & save, Find by interest |
| `assets/ranking.js` | Pure rules: binary insertion, seed, move, pending, friends' average | Compare & correct |
| `assets/events.js` | Pilot event log (OEC events, museum IDs only) | all |
| `assets/visit-friends.js` | Which tagged friends are allowed | Log & remember |
| `assets/store.js` | Model: load and save the notebook in `localStorage` | all |
| `assets/ui-core.js` | Shared UI state, helpers, save-then-commit (`MR.commit`) | all |
| `assets/ui-discover.js` | Views: Discover cards and Profile (with the activity log) | Find & save |
| `assets/ui-ranking.js` | Views: Ranking, Friends' average, Leaderboard, friend pickers | Compare & correct |
| `assets/ui-dialogs.js` | Controllers: save, log a visit, edit a note, comparisons | Log, Edit, Compare |
| `assets/app.js` | Event wiring: clicks, typing, filters and form submits | all |

The rules files have no DOM or storage code, so `tests/rules.test.cjs` tests them in Node.

## Tests and deploy

`npm ci && npm test` runs the unit tests (`tests/rules.test.cjs`, `tests/visit-model.test.cjs`), an integration test
(`tests/visit-browser.test.cjs`, stored visits) and system tests in headless Chrome (visit tagging with a failed save,
and ranking with reorder and reload). GitHub Actions (`.github/workflows/pages.yml`) runs them on every push and pull
request. On `main`, a passing run publishes `index.html` and `assets/` to GitHub Pages, once Pages is enabled and the
repository variable `PAGES_ENABLED` is `true`.

## Pilot activity log

For test sessions the app records the charter's events in this browser: `website_opened`, `museum_saved`,
`museum_unsaved`, `visit_logged`, `visit_save_failed`, `comparison_completed`, `ranking_viewed`, `rank_moved`,
`note_edited` and `storage_failed`. Each has a time and, where relevant, a museum ID; never notes or names. The
facilitator downloads them from Profile → Download activity log. They also print to the console as
`[museum-rankings] …`.

## Other files in this repo

`index.html` is the Museum Rankings app. `magic-8-ball.html`, `preview.html`, `test.txt` and `sarah_firstclass` are
earlier Coding with GPT class exercises kept for the record. They are not part of the product and are not published.

## Publishing

In the repository's **Settings → Pages**, choose **GitHub Actions** as the source, then add the repository variable `PAGES_ENABLED` = `true` (Settings → Secrets and variables → Actions → Variables). Commits to `main` that pass the tests will then publish the site. The public URL will be `https://ssukin.github.io/codingwithGPT/` once the Pages deployment is enabled.

## Pilot directory

The initial directory covers 13 Smithsonian museum institutions in Washington, DC, including the National Zoo. Museum names, descriptions, locations, and official information links are based on the Smithsonian's [museum visitor directory](https://www.si.edu/visit/museums) and [National Zoo visitor information](https://nationalzoo.si.edu/visit). Hours and admission requirements can change, so the app links back to official museum information.

Museum photos are from Wikimedia Commons. Each photo card shows its creator and links to its source and license; visit-list thumbnails link to the same usage details.

## Product scope

The first web version includes the proposal's personal MVP: browse, search, and filter (by status, category, and location), links to each museum's official website, a private Want to visit list, visit logging, head-to-head comparisons, and an editable ranking. It also includes a Leaderboard, a friends' average ranking, and tagging friends on visits, using invented sample friends (labelled Sample) rather than real accounts. Real friend accounts, map views, public sharing, recommendations, reviews, notifications, and monetization are deferred. Account sign-in and cross-device sync can be added in a later version.

This repository is for Coding with GPT on Mondays and Tuesdays at 2:45–4:10 pm.

This is an update (Gila).