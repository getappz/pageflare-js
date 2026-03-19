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
  platform: 'auto',    // 'auto' | 'vercel' | 'netlify' | 'cloudflare-pages' | 'none'
  log: 'warn',         // 'off' | 'error' | 'warn' | 'info' | 'debug'
  args: ['--force'],   // extra CLI flags
})
```

## How It Works

This package depends on `@pageflare/cli`, which installs the platform-specific pageflare binary. Each integration hooks into the framework's post-build lifecycle and runs `pageflare <outputDir> --in-place` to optimize HTML, CSS, JS, images, and fonts.

## Documentation

- [Getting Started](https://pageflare.dev/docs/getting-started)
- [CLI Commands](https://pageflare.dev/docs/cli/commands)
- [Configuration](https://pageflare.dev/docs/cli/configuration)
- [Changelog](https://pageflare.dev/docs/changelog)

## License

MIT
