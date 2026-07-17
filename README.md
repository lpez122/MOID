# MOID website

A lightweight, dependency-free website for the Massive Object Image Database. The public showcase contains 10 optimized images from each of 200 object concepts, balanced across all 13 broad corpus categories.

## Run locally

```bash
cd MOID_website
npm run catalog
npm start
```

Open `http://127.0.0.1:4173`.

The catalog command selects 200 concepts with at least 10 finalized images, creates 640px JPEG derivatives, and places the 2,000 web assets in `public/images`. The high-resolution source corpus is never modified.

## Refresh the catalog

Run `npm run catalog` whenever source images are added, renamed, or removed. Image conversion currently uses the macOS `sips` utility.

## GitHub Pages

Every push to `main` deploys the contents of `public` through the Pages workflow in `.github/workflows/deploy-pages.yml`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions** if it is not selected automatically.

Add final licensing, attribution, access, and contact details before treating the showcase as a formal public dataset release.
