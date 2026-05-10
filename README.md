# pageflare

Framework integrations for Pageflare — Vite, Nuxt, Astro, Next.js, and Netlify plugins for zero-config static site optimization.

## Install

```bash
npm install -D pageflare
```

## Vite

```ts
// vite.config.ts
import pageflare from 'pageflare/vite'

export default defineConfig({
  plugins: [pageflare()]
})
```

Also works with SvelteKit, Remix, and SolidStart (all Vite-based).

## Astro

```ts
// astro.config.mjs
import pageflare from 'pageflare/astro'

export default defineConfig({
  integrations: [pageflare()]
})
```

## Nuxt

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['pageflare/nuxt'],
  pageflare: {
    platform: 'vercel' // optional
  }
})
```

## Next.js

Next.js integration supports `output: 'export'` mode. Chain pageflare after the build:

```json
{
  "scripts": {
    "build": "next build && pageflare out/"
  }
}
```

Or use the programmatic API:

```ts
// scripts/build.mjs
import { optimizeNextExport } from 'pageflare/next'
await optimizeNextExport()
```

Optionally validate your config:

```ts
// next.config.mjs
import withPageflare from 'pageflare/next'

export default withPageflare()({
  output: 'export',
})
```

## Netlify

```toml
# netlify.toml
[[plugins]]
package = "pageflare"
```

Pass extra CLI flags:

```toml
[[plugins]]
package = "pageflare"
  [plugins.inputs]
  args = "--force --platform netlify"
```

## Options

All integrations accept the same options:

```ts
pageflare({
  // Pipeline
  platform: 'auto',          // 'auto' | 'vercel' | 'netlify' | 'cloudflare-pages' | 'none'
  prod: true,                // Production build — enables platform CDN image rewrites
  cleanOutput: true,         // Wipe output dir before writing (refuses if equal to input)
  noBrowser: true,           // Force heuristic fallback (no real-browser extraction)
  failOnBrokenRefs: true,    // Exit non-zero on internal 404 references

  // Build-time SEO/GEO/Audit/PWA opt-ins (idempotent, off by default)
  withGeo: true,             // sitemap.xml, robots.txt, llms.txt, .well-known/*
  withSeo: true,             // viewport / charset / canonical / OG meta
  withAudit: true,           // emit audit.json
  withPwa: true,             // manifest, service worker, icons (reads pageflare.pwa.jsonc)

  // Diagnostics + escape hatch
  log: 'warn',               // 'off' | 'error' | 'warn' | 'info' | 'debug'
  args: ['--force'],         // extra CLI flags passed verbatim
  configOverrides: {         // override pageflare.jsonc fields per-build
    'image.format': 'avif',
  },
})
```

Each option maps 1:1 to the underlying CLI flag (`cleanOutput → --clean-output`, `withGeo → --with-geo`, etc.) — see the [CLI reference](https://www.npmjs.com/package/@pageflare/cli) for what each one does.

## How It Works

This package depends on `@pageflare/cli`, which installs the platform-specific pageflare binary. Each integration hooks into the framework's post-build lifecycle and runs `pageflare <outputDir> --output <outputDir>` to optimize HTML, CSS, JS, images, and fonts in place. Pass `inPlace: false` if you'd rather have pageflare write to its default `<outputDir>/.appz/output/static/` instead.

Pageflare 0.9+ uses a real browser (Chrome via Lightpanda) to extract above-fold critical CSS, hero/LCP preload candidates, font preloads, and below-fold lazy-render boundaries — replacing string-scanning heuristics with layout-aware decisions. CI environments without Chrome can opt out with `noBrowser: true` (or `args: ['--no-browser']`) to fall back to the heuristic path.

## Documentation

- [Getting Started](https://pageflare.dev/docs/getting-started)
- [CLI Commands](https://pageflare.dev/docs/cli/commands)
- [Configuration](https://pageflare.dev/docs/cli/configuration)
- [Changelog](https://pageflare.dev/docs/changelog)

## License

MIT
