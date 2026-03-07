# Log App

A simple, fast logging app for tracking anything with custom channels and presets.

## Features

- **Channels** — organise logs into separate categories (e.g. "Liam sickness", "Work log")
- **Notes** — free-text entries, just type and hit Enter
- **Presets** — quick-log templates with custom fields (e.g. "Calpol → Dose: 5ml")
- **Persistent** — all data stored in browser localStorage, no backend needed
- **Responsive** — works on desktop and mobile

## Usage

1. Create a channel
2. Optionally add presets via the ⚙ settings icon (e.g. a "Calpol" preset with a "Dose" number field in ml)
3. Log notes or tap a preset pill to quickly log a value

## Development

```bash
npm install
npm run dev
```

## Deploy

Pushes to `master` automatically build and deploy to GitHub Pages via GitHub Actions.
