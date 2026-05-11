# VenusBench-Mobile Leaderboard

Static leaderboard page for VenusBench-Mobile.

## Files

- `index.html`: page markup and metadata
- `style.css`: visual styling
- `leaderboard.js`: table rendering, filtering, tabs, and sorting
- `results/venusbench-mobile.json`: structured benchmark results
- `ui-venus-logo.png` and `ui-venus-logo.ico`: UI-Venus logo assets

## Local Preview

Serve the directory with a static file server because the page loads JSON with `fetch`.

```bash
python3 -m http.server 8000 --directory venusbench-mobile-leaderboard
```

Then open `http://localhost:8000`.

## Updating Results

Edit `results/venusbench-mobile.json`. The main ranking uses `scores.total` by default, and the other tabs read from `stability`, `cost`, and `diagnostics`.
