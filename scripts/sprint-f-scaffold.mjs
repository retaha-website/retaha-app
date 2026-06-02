#!/usr/bin/env node
/**
 * Sprint F · Phase A — Foundation-Scaffold
 *
 * Generiert apps/ + packages/ Skeleton-Struktur für Turborepo-Monorepo.
 *
 * Idempotent: kann mehrfach laufen, überschreibt aber existing Files.
 * NUR auf Feature-Branch sprint-f-monorepo-split verwenden.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

// ─────────────────────────────────────────────────────────────
// 7 PACKAGES
// ─────────────────────────────────────────────────────────────

const PACKAGES = [
  {
    name: 'db',
    description: 'Supabase-Client + Type-Generation + Migrations',
    extraDeps: {
      '@supabase/supabase-js': '^2.106.1',
      '@supabase/ssr': '^0.10.3',
    },
  },
  {
    name: 'auth',
    description: 'Permission-Helper, Session-Cookie-Setter, Cross-Subdomain SSO',
    extraDeps: {
      jose: '^6.2.3',
      jsonwebtoken: '^9.0.3',
      '@types/jsonwebtoken': '^9.0.10',
      '@retaha/db': 'workspace:*',
    },
  },
  {
    name: 'ui',
    description: 'Shared Astro-Components, Theme-System, Bauhaus-DNA',
    extraDeps: {
      astro: '^6.3.6',
      alpinejs: '^3.15.12',
      '@alpinejs/collapse': '^3.15.12',
      '@fontsource/space-grotesk': '^5.2.10',
      '@fontsource/jetbrains-mono': '^5.2.8',
      '@fontsource/inter-tight': '^5.2.7',
      '@fontsource/cormorant-garamond': '^5.2.11',
      tailwindcss: '^4.3.0',
      '@tailwindcss/vite': '^4.3.0',
    },
  },
  {
    name: 'wallet',
    description: 'Wallet-Pass-Lib: push-guard, Google-Wallet, Apple-Wallet',
    extraDeps: {
      'google-auth-library': '^10.6.2',
      'web-push': '^3.6.7',
      '@types/web-push': '^3.6.4',
      '@retaha/db': 'workspace:*',
    },
  },
  {
    name: 'marketing',
    description: 'Marketing-Lib: Drips, Bulk-Send, Translate-with-Vars',
    extraDeps: {
      '@anthropic-ai/sdk': '^0.100.1',
      '@retaha/db': 'workspace:*',
      '@retaha/wallet': 'workspace:*',
    },
  },
  {
    name: 'eve',
    description: 'Eve-KI-Concierge: Hybrid Router, Tools, Context-Loader',
    extraDeps: {
      '@anthropic-ai/sdk': '^0.100.1',
      '@retaha/db': 'workspace:*',
    },
  },
  {
    name: 'i18n',
    description: 'i18n-Setup: Locale-Detection, Auto-Translation, 10 Sprachen',
    extraDeps: {
      '@anthropic-ai/sdk': '^0.100.1',
      '@retaha/db': 'workspace:*',
    },
  },
];

function packageJson(pkg) {
  const deps = Object.entries(pkg.extraDeps)
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});

  return JSON.stringify({
    name: `@retaha/${pkg.name}`,
    description: pkg.description,
    version: '0.0.0',
    type: 'module',
    private: true,
    main: './src/index.ts',
    types: './src/index.ts',
    exports: {
      '.': './src/index.ts',
      './*': './src/*.ts',
    },
    dependencies: deps,
    devDependencies: {
      typescript: '^5.6.3',
    },
  }, null, 2) + '\n';
}

const TSCONFIG_PACKAGE = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "jsx": "preserve",
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src/**/*"]
}
`;

function packageIndex(pkg) {
  return `// @retaha/${pkg.name}
// ${pkg.description}
//
// Skeleton — Phase B füllt diesen Package mit migriertem Code aus src/lib/.

export const PACKAGE_NAME = '@retaha/${pkg.name}';
`;
}

for (const pkg of PACKAGES) {
  const dir = `packages/${pkg.name}`;
  write(join(dir, 'package.json'), packageJson(pkg));
  write(join(dir, 'tsconfig.json'), TSCONFIG_PACKAGE);
  write(join(dir, 'src/index.ts'), packageIndex(pkg));
  console.log(`  ✓ packages/${pkg.name}/  (${Object.keys(pkg.extraDeps).length} deps)`);
}

// ─────────────────────────────────────────────────────────────
// 4 APPS
// ─────────────────────────────────────────────────────────────

const APPS = [
  {
    name: 'auth',
    description: 'auth.retaha.de — Magic-Link-Empfänger, Login-UI, SSO-Cookie-Setter',
    port: 4321,
    heading: 'auth',
    subtitle: 'magic-link-empfänger · sso-cookie-setter',
  },
  {
    name: 'guest',
    description: 'app.retaha.de — Gast-Frontend (Hub, 8 Sheets, Eve-Chat, NFC-Routes)',
    port: 4322,
    heading: 'guest',
    subtitle: 'hub · 8 sheets · eve-chat · nfc-routes',
  },
  {
    name: 'dashboard',
    description: 'dashboard.retaha.de — Hotelier-Operations (Daily-Business)',
    port: 4323,
    heading: 'dashboard',
    subtitle: 'qr · service · bookings · check-ins',
  },
  {
    name: 'backoffice',
    description: 'backoffice.retaha.de — Hotelier-Config (Settings, Marketing, Themes)',
    port: 4324,
    heading: 'backoffice',
    subtitle: 'settings · marketing · themes · nfc-tags',
  },
];

function appPackageJson(app) {
  return JSON.stringify({
    name: `@retaha/${app.name}-app`,
    description: app.description,
    version: '0.0.0',
    type: 'module',
    private: true,
    scripts: {
      dev: `astro dev --port ${app.port}`,
      build: 'astro build',
      preview: `astro preview --port ${app.port}`,
      'type-check': 'astro check',
    },
    dependencies: {
      '@retaha/ui': 'workspace:*',
      '@retaha/db': 'workspace:*',
      '@retaha/auth': 'workspace:*',
      '@retaha/wallet': 'workspace:*',
      '@retaha/marketing': 'workspace:*',
      '@retaha/eve': 'workspace:*',
      '@retaha/i18n': 'workspace:*',
      '@astrojs/vercel': '^10.0.7',
      astro: '^6.3.6',
      tailwindcss: '^4.3.0',
      '@tailwindcss/vite': '^4.3.0',
    },
  }, null, 2) + '\n';
}

function appAstroConfig(app) {
  return `// @retaha/${app.name}-app — ${app.description}
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  server: { port: ${app.port} },
  vite: {
    plugins: [tailwindcss()],
  },
});
`;
}

function appTsconfig() {
  return `{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", ".vercel"]
}
`;
}

function appIndexPage(app) {
  return `---
// @retaha/${app.name}-app — Skeleton landing page
// Phase ${app.name === 'auth' ? 'C' : app.name === 'guest' ? 'D' : app.name === 'dashboard' ? 'E' : 'F'} migriert echten Inhalt hier ein.
---
<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${app.heading} · retaha</title>
    <style>
      :root {
        --accent: #FF4A82;
        --bg: #FFFFFF;
        --text: #1A1A1A;
      }
      body {
        margin: 0;
        font-family: 'Space Grotesk', system-ui, sans-serif;
        background: var(--bg);
        color: var(--text);
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 32px;
      }
      .shell { text-align: center; max-width: 420px; }
      .eyebrow {
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--accent);
        margin: 0 0 16px;
      }
      h1 {
        font-size: 56px;
        font-weight: 300;
        letter-spacing: -0.02em;
        margin: 0 0 12px;
      }
      .dot { color: var(--accent); }
      .sub {
        font-size: 14px;
        line-height: 1.5;
        opacity: 0.65;
        margin: 0 0 24px;
      }
      .port {
        display: inline-block;
        padding: 6px 12px;
        background: rgba(255, 74, 130, 0.08);
        color: var(--accent);
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        letter-spacing: 0.08em;
        border-left: 3px solid var(--accent);
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <p class="eyebrow">— sprint f · phase a —</p>
      <h1>${app.heading}<span class="dot">.</span></h1>
      <p class="sub">${app.subtitle}</p>
      <span class="port">PORT ${app.port}</span>
    </main>
  </body>
</html>
`;
}

function appLayout(app) {
  return `---
// Minimal layout placeholder — packages/ui wird in Phase B mit echtem
// AdminLayout/GuestLayout aus dem root-src/ befüllt.
interface Props {
  title: string;
}
const { title } = Astro.props;
---
<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title} · ${app.heading}.retaha</title>
  </head>
  <body>
    <slot />
  </body>
</html>
`;
}

for (const app of APPS) {
  const dir = `apps/${app.name}`;
  write(join(dir, 'package.json'), appPackageJson(app));
  write(join(dir, 'astro.config.mjs'), appAstroConfig(app));
  write(join(dir, 'tsconfig.json'), appTsconfig());
  write(join(dir, 'src/pages/index.astro'), appIndexPage(app));
  write(join(dir, 'src/layouts/AppLayout.astro'), appLayout(app));
  console.log(`  ✓ apps/${app.name}/  (port ${app.port})`);
}

console.log(`\nScaffold complete: ${PACKAGES.length} packages + ${APPS.length} apps`);
