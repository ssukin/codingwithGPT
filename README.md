# Museum Rankings

A museum discovery and personal ranking app for Smithsonian museums in Washington, DC. This is an independent concept project and is not affiliated with the Smithsonian Institution.

## Try the app

Open `index.html` in a web browser. Search the directory, save museums to **Want to visit**, log visits, then compare and reorder your personal ranking.

Your profile, saved list, visits, notes, and ranking are stored in this browser on this device. They do not sync to other devices. Clearing this browser's site data will erase them.

## Pages

- `index.html` — Museum Rankings
- `magic-8-ball.html` — the separate Magic 8 Ball app

## Publishing

The repository includes a GitHub Actions workflow for GitHub Pages. In the repository's **Settings → Pages**, choose **GitHub Actions** as the source. New commits to `main` will then publish the site. The public URL will be `https://ssukin.github.io/codingwithGPT/` once the Pages deployment is enabled.

## Pilot directory

The initial directory covers 13 Smithsonian museum institutions in Washington, DC, including the National Zoo. Museum names, descriptions, locations, and official information links are based on the Smithsonian's [museum visitor directory](https://www.si.edu/visit/museums) and [National Zoo visitor information](https://nationalzoo.si.edu/visit). Hours and admission requirements can change, so the app links back to official museum information.

Museum photos are from Wikimedia Commons. Each photo card shows its creator and links to its source and license; visit-list thumbnails link to the same usage details.

## Product scope

The first web version includes the proposal's personal MVP: browse and search, museum details, a private Want to visit list, visit logging, head-to-head comparisons, and an editable ranking. Friends, map views, public sharing, recommendations, reviews, notifications, and monetization are deferred. Account sign-in and cross-device sync can be added in a later version.

This repository is for Coding with GPT on Mondays and Tuesdays at 2:45–4:10 pm.

This is an update (Gila).
## Wishlist tests

As a visitor, I want to save a museum so I can find it later. Given an unsaved museum, saving it adds it to **Want to visit**, including after a reload. Removing it takes it out of that list, including after another reload.

With Node.js 24 installed, run:

```sh
npm install
npx playwright install chromium
npm test
```

- **Unit** checks the list rule directly. It adds and removes the selected museum while retaining a different saved museum. The page or browser storage could still be broken.
- **Integration** uses two fixture museums, triggers the actual app handler, and checks browser storage and the rendered list. A button could still be covered by another element, since a programmatic click bypasses pointer interaction.
- **System** opens the full app and uses Playwright to click the real buttons and reload the page. Other browsers, museum details, and unrelated app paths could still be broken.

Run only the dependency-free unit test with `npm run test:unit`. GitHub Actions runs that command for every push and pull request.
