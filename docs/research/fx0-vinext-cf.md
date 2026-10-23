# fx0 through vinext on ordinary Cloudflare Workers

Researched 2026-10-23 against fx0 commit `d8295b4313b40fc01de8b18db4806b2f4538eebe`. This answers research ticket `01-vinext-cloudflare-compatibility`. The canonical parent map, issue and `GLOSSARY.md` were read from `/Users/andreichira/Downloads/projects/fx0`; their uncommitted contents are outside this evidence branch. The previous failed run supplied no findings.

## Recommendation

Proceed with a bounded vinext compatibility prototype before promising a production port. The existing App Router UI has a plausible supported path. The checked checkout is **not ready to run unchanged on Workers**. Its public URL fetcher, Markdown packaging, Vercel queue endpoint, BotID and service integrations need work. Its newest Next.js navigation settings lack verified parity. A successful import scan does not settle those questions.

There **is a supported cf integration** in current vinext source and published packages. Use Cloudflare Vite plugin v2, `cloudflare.config.ts`, the vinext App Router Vite environments, and `cf dev` / `cf build` / `cf deploy`. Do not initialize a Wrangler project. The upstream migration skill and its references lag the current implementation on this point; the main README, config generator, deployment code and cf's own vinext detection agree on the cf path. This is source and package evidence, not a build or deployment result. [vinext initialization][init], [typed config generator][typed-config], [deployment selection][deploy], [cf vinext detection][cf-vinext]

Keep Build dynamic and deployed separately from Drop. Generating a static multi-page site is an application operation, not a reason to set Build's own `next.config` to `output: 'export'`. Keep one model and request-bound generation with the tab open, saved projects and completed versions, retry after interruption, and explicit Publish to Drop. Nothing in this research selects allowance amounts, a model, a budget, storage, shared identity, or a publication protocol.

## Evidence and actual checks

The research followed Phase 1 of the explicitly requested [upstream migration skill][skill]. `next` is a dependency, `package-lock.json` selects npm, and `app/` selects App Router. I installed the upstream skill with `npx skills add cloudflare/vinext --skill migrate-to-vinext --agent codex --copy -y` in this isolated checkout and read its compatibility, configuration and troubleshooting references. I did not run `vinext init` or perform a migration.

| Item | Observed result |
| --- | --- |
| fx0 dependency versions | Lockfile resolves Next `16.4.2`, React and React DOM `19.2.4`, libfx `0.0.14`, Geist `1.7.2`, BotID `1.5.11`. Package manifest requires Node `24.x`; this check actually ran on Node `26.8.2`, npm `11.19.1`. See [package.json:23][package]. |
| Current upstream source | vinext `cffccb6dbebc7eeb5d57849952887637060813e8`; cf `7993e1d1b3d919d9726990c4801663181567e8e9`. Fresh shallow source clones under `/tmp`, independent of the earlier failed worktree. Source citations below pin these revisions. |
| Published tooling inspected | Registry reported vinext `1.3.0`, `@vinext/cloudflare` `1.2.0`, plugin latest `1.65.0`, plugin beta `2.0.0-beta.v.4`. Installed cf is `1.0.0-beta.12`. I extracted the published `@vinext/cloudflare@1.2.0` tarball and confirmed typed-config detection and `cf deploy --prebuilt` selection. These are inspection results, not a tested dependency combination. |
| First check | `npx --yes vinext@1.3.0 check` exited 1 before scanning: `ERR_MODULE_NOT_FOUND`, missing `vite` in the ephemeral npx installation. This was a tooling dependency failure. |
| Completed check | `npx --yes --package=vinext@1.3.0 --package=vite@8.1.2 vinext check` exited 0. Result: **95% compatible**, 17 supported, 2 partial, 0 issues. All seven detected Next import spellings passed. Config partials were `turbopack` and `cacheComponents`. It found 2 pages, 1 layout, 21 route handlers, and recognized the string-form PostCSS plugin. |
| CLI discovery | Ran `cf --help`, `cf cli search "build develop deploy Vite framework project configuration"`, and inspected help for `build`, `deploy`, `dev`, `init`. `deploy` exposes `--prebuilt` and `--dry-run`; `dev` delegates to framework development tooling. No initializer, build, deployment or resource command was executed. |
| Next documentation | No project `node_modules` was present. Extracted only the bundled guides and config types from the published `next@16.4.2` tarball to `/tmp`, then read the guides for `partialPrefetching`, `ensureStatic`, `connection`, `after` and `use cache: remote`. This respects the checkout's warning to inspect this Next version rather than assume older behavior. |

The check is a source/import/config inventory. Its config scan iterates a known support table; it does not validate every arbitrary Next option. Thus its omission of `partialPrefetching` and file tracing is not evidence they work. It also does not execute BotID, traverse all libfx runtime behavior, exercise DNS, render the UI, inspect cookie behavior, or test Worker packaging. See [scanner implementation][scanner].

No fx0 dev server, Vite production build, workerd session, browser acceptance run, application tests, paid model/API call, provisioning or deployment ran. Neither parent planning files nor Drop changed. The full local check logs are `/tmp/fx0-vinext-check-20261023-r2.log` and `/tmp/fx0-vinext-check-peers-20261023-r2.log`; the commands, failures and substantive output are preserved above because those temporary files are not durable evidence.

## What carries over, and what needs changes

| Area in this checkout | Evidence and decision |
| --- | --- |
| App Router and client UI | Layouts, route handlers, RSC and streaming SSR are documented vinext capabilities. fx0 has two pages and conventional client components, with `next-themes`, Radix and Tailwind. The scanner recognizes next-themes, Tailwind and Radix Dialog. Retain the chat/sidebar/preview UI; exercise the other Radix components and hydration rather than treating this small allowlist as exhaustive package testing. [Workers framework guide][framework], [app/layout.tsx:1][layout], [components/chat-app.tsx:31][chat-ui] |
| `.js` suffix imports | Preserve `next/server.js`, `next/headers.js`, `next/cache.js`, `next/dynamic.js` and ordinary `next/*` imports. All passed the scan; current vinext explicitly aliases file-backed `.js` public entrypoints. Do not rewrite these imports to `vinext/*`. Their resolution is source-supported, while fx0's complete dependency graph remains unbuilt. [shim aliases][aliases], [lib/secure-session.ts:1][secure-session] |
| React and build dependencies | vinext `1.3.0` declares React/React DOM `^19.3.1`, Vite `^8.0.0`, and optional App Router RSC peers. fx0 pins `19.2.4`, below the React peer range. Align React, React DOM and the RSC dependency set in the prototype; do not suppress the mismatch with forced installation. Install `@vitejs/plugin-rsc`, but let `vinext()` register it once. fx0 already uses ESM and `.mjs` configs. [published vinext manifest][vinext-manifest], [package.json:39][package], [RSC configuration][rsc-config] |
| Tailwind and aliases | `postcss.config.mjs` uses `plugins: ['@tailwindcss/postcss']`; the completed scanner explicitly recognizes that format. `app/globals.css` uses Tailwind 4's import and theme syntax. Contrary to the older skill reference's broad warning that Turbopack is ignored, current config loading extracts `turbopack.resolveAlias` and `resolveExtensions`. fx0's `clsx` and `tailwind-merge` aliases to `cn` therefore have source support. Prefer explicit Vite aliases when simplifying the migration config and check class merging; do not copy `turbopack.root` or loader rules as if Vite implements Turbopack. [next.config.mjs:8][next-config], [PostCSS config][postcss], [app/globals.css:1][css], [alias extraction][config] |
| Fonts and metadata | fx0 imports `GeistSans` and `GeistMono` from the `geist` package, not directly from `next/font/google`. Current font transformation includes package-local font handling and a regression test specifically for Geist paths. Retain it initially and verify emitted WOFF assets and CSS variables in both dev and production. Do not assume older skill notes about Google CDN fonts describe this package. Metadata is supported, but change the hardcoded `https://fx0.vercel.dev` metadata base and validate generated icon/Open Graph URLs. [app/layout.tsx:1][layout], [font transformer][fonts], [font regression test][font-test] |
| `cacheComponents` | This flag is read, but the actual checker labels support experimental and incomplete. Preserve it for investigation, not as a parity guarantee. Prove signed-in and signed-out streaming with cookies and request-specific data, and prevent cached account content from reaching another client. [next.config.mjs:5][next-config], [app/page.tsx:15][page], [scanner][scanner] |
| `partialPrefetching` and `ensureStatic` | Next 16.4.2 documents both. fx0 enables partial prefetching and exports `ensureStatic = 'shell'` in its root layout. Searches found no handling for either name in vinext's runtime/config implementation or published JS, and the scanner does not report them. Treat these exact semantics as an unsupported/unverified gap, not as a successful check. The Next guide says partial prefetching requires cache components; it changes shell prefetching and navigation behavior. Plan to omit the optimization and its shell assertion in an isolated candidate unless a targeted test demonstrates parity. Correct dynamic rendering takes priority over retaining an unproven optimization. [Next partial-prefetch guide][next-partial], [Next ensureStatic guide][next-static], [app/layout.tsx:32][layout], [vinext config][config] |
| `connection()` | vinext implements this request-time rendering marker, including a cache-scope guard. Keep it in the initial candidate, then verify account loading, login redirects and the model route do not become static. It neither keeps a socket alive nor provides generation durability. [server shim][server], [app/page.tsx:16][page], [app/api/models/route.ts:28][models] |
| `after()` | Implemented through request execution context and `waitUntil`. Suitable for short best-effort cleanup; not a replacement for Vercel's durable queue. Review every use, particularly `after(() => followChat(host))`, history repair passed through `readTranscript`, signout cleanup and asset cleanup. Await correctness-critical state changes before acknowledging success, leaving only bounded retryable work after the response. [server shim][server], [app/api/prompt/route.ts:146][prompt], [app/page.tsx:43][page], [app/api/auth/signout/route.ts:15][signout] |
| Remote image cache | `cachedRemoteImage` uses `'use cache: remote'` and `cacheLife` with one-day revalidation and seven-day expiry. vinext transforms that directive, but its runtime uses the shared data-cache handler; the directive alone does not provide Vercel Runtime Cache. Configure a persistent adapter or replace this cache explicitly. Current Cloudflare adapters include KV data caching. Keep cache failures separate from completed-version persistence, and verify failed image fetches do not become durable cache entries. [lib/remote-image-cache.ts:1][remote-cache], [cache runtime][cache-runtime], [KV adapter][kv-adapter] |
| Node crypto/events/buffers | Workers has Node compatibility for these APIs; importing `node:*` is not automatically a blocker. fx0 uses crypto, `EventEmitter`, `Buffer`, and timers. Verify exact methods in workerd. Global maps and local events are per-isolate hints, never authoritative cross-request state. The existing journal already distinguishes its local emitter from Redis-backed records. [Workers Node compatibility][node-compat], [lib/journal.ts:1][journal], [lib/remote-image-cache.ts:43][remote-cache] |
| Filesystem design guides | `catalogDesignMd` uses `process.cwd()/lib/design-md/<id>.md`; `outputFileTracingIncludes` is a Next packaging instruction, not a verified Vite inclusion rule. Workers now has a virtual filesystem, but `/bundle` only contains included bundle modules and `/tmp` is request-local. This does not reproduce a checkout filesystem. Prefer a build-time raw-import map of the finite Markdown catalog, with an allowlisted ID lookup; test every catalog entry after production bundling. Vite supports raw imports and glob imports. Do not declare `node:fs` universally unavailable, and do not preserve the current relative-path read on that basis alone. [app/api/prompt/route.ts:19][prompt], [next.config.mjs:15][next-config], [Workers filesystem][fs], [Vite imports][vite-assets] |
| Public URL fetching | A concrete incompatibility. `publicDestination` calls `dns.lookup`, which Workers documents as unimplemented. Its `http/https.request` also supplies a custom `lookup` callback to connect to the validated IP while retaining the original hostname. Workers' HTTP wrapper does not support that option. Enabling Node compatibility or replacing only DNS resolution cannot preserve the current DNS-rebinding defense. Both model `web_fetch` and remote images depend on this path. Design and test a Workers-supported fetch policy with equivalent public-address, redirect, protocol, abort and byte limits, or omit arbitrary URL fetching until it is safe. Plain `fetch(url)` after a DNS preflight is not an equivalent implementation. [lib/public-fetch.ts:35][public-fetch], [lib/public-fetch.ts:80][public-fetch], [lib/tools.ts:137][tools], [Workers DNS][dns], [Workers HTTP request options][http] |

### Vercel integrations are separate work

The UI framework port does not migrate these services:

- BotID spans the `withBotId` config wrapper, `instrumentation-client.ts`, and server `checkBotId()`. Vercel's current instructions require a project deployed on Vercel, which routes challenge traffic. Replace this protection before enabling funded public generation. A browser initialization hook compiling is not evidence bot protection works on Workers. Also replace `trialIpHash`: it currently throws outside Vercel production because it only trusts Vercel's forwarded IP. Choose verified Cloudflare ingress signals and account allowance enforcement in the quota/auth work, rather than spoofing `VERCEL=1`. [next.config.mjs:1][next-config], [instrumentation-client.ts:1][instrumentation], [app/api/prompt/route.ts:79][prompt], [lib/trial.ts:84][trial], [BotID requirements][botid]
- `/api/auth/signin`, `/api/auth/callback`, token refresh/revocation, team selection, `/api/teams`, `/api/credits`, and the Vercel model catalog need new product/backend behavior. `lib/auth-protocol.ts` also trusts Vercel preview environment variables. Configure Build's trusted origin and shared-account protocol explicitly. Cookie API compatibility does not grant safe cross-app session sharing. The fixed-model release can remove the remote model picker/catalog instead of porting it. [lib/auth.ts:39][auth], [lib/auth-protocol.ts:46][auth-protocol], [app/api/credits/route.ts:14][credits], [app/api/models/route.ts:34][models]
- Neon account/history queries, Upstash Redis journal/draft/Lua operations, and Vercel Blob assets need selected replacements. They may use Worker-compatible HTTP transports today, but the confirmed scope removes the services. Preserve ownership, atomic admission, idempotency and completed-version boundaries while replacing their behavior. KV cache support is not evidence that KV can replace Redis Lua transactions. [lib/accounts.ts:38][accounts], [lib/journal.ts:19][journal], [lib/draft-store.ts:19][draft-store], [lib/design-assets.ts:1][assets]
- `/api/libfx` currently relies on a Vercel queue trigger making the route non-public. An ordinary Worker route handler would not inherit that protection. Remove that route for the tab-open design or authenticate it under an explicitly chosen mechanism. `vercel.json` queue triggers and `maxDuration = 800` do not configure Workers. `serverExternalPackages: ['libfx']` does not leave libfx outside a Worker bundle: current vinext bundles server externals for Cloudflare, where no runtime `node_modules` exists. The default libfx durability choice and provider transport need the sibling report's decision. Do not mistake bundle success for support for local-file persistence or Vercel World/Queues. [app/api/libfx/route.ts:1][libfx-route], [vercel.json:4][vercel], [lib/libfx-agent.ts:203][libfx-agent], [external package handling][externals]

For generation, keep the response that owns model work open and propagate cancellation. Workers permits long HTTP wall-clock execution while a client remains connected, subject to CPU/resource limits and runtime interruption. `waitUntil` extends execution only up to 30 seconds after response completion or disconnect. The existing prompt stream follows journal events and starts `followChat` through both a wake callback and `after`; its `maxIdleMs: 300` controls polling delay, not a 300 ms request deadline. Keeping that response shape does not prove a replacement model loop belongs to its request lifecycle. The event route's five-minute reconnect policy also needs a defined relationship to the generation request. On disconnect or process loss, preserve the last complete site version, mark interruption, and permit an idempotent retry. Do not promise continuation of partial work. [Workers duration limits][limits], [app/api/prompt/route.ts:148][prompt], [lib/event-stream.ts:7][event-stream], [app/api/events/route.ts:5][events]

## A cf configuration path that respects the CLI rule

Use the current typed-config path, not the older `wrangler.jsonc` examples in the skill. Current vinext initialization installs `@cloudflare/vite-plugin@beta` and `cf@latest` for that path; plugin `latest` is still v1. Pin the actual compatible versions in the prototype lockfile. The published `@vinext/cloudflare@1.2.0` code selects cf when `cloudflare.config.ts` exists, and constructs `cf deploy --prebuilt`. The installed cf package contains the vinext-specific Vite command override. [init dependency selection][init], [deployment implementation][deploy], [cf implementation][cf-vinext]

The following is a **source-derived candidate**, not a config built in this run. It deliberately has no data/CDN cache or image-optimization resource. Those bindings belong to later explicit decisions. The entrypoint, typed property names, assets binding and asset-routing policy come from vinext's current generator. [typed config generator][typed-config]

```ts
// cloudflare.config.ts
import { bindings, defineConfig, defineWorker } from 'cf/config'

export default defineConfig({
  worker: defineWorker({
    name: 'build-compatibility',
    entrypoint: 'vinext/server/fetch-handler',
    compatibilityDate: '2026-10-23',
    assets: {
      htmlHandling: 'none',
      notFoundHandling: 'none',
      runWorkerFirst: ['/*', '!/_next/static/*', '!/*/_next/static/*'],
    },
    env: { ASSETS: bindings.assets() },
  }),
})

// vite.config.ts
import { defineConfig } from 'vite'
import vinext from 'vinext'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
    }),
  ],
})
```

The compatibility date and flags must be checked against the pinned local workerd. Current Workers docs enable Node compatibility by default for dates from 2026-08-04 and recommend omitting the redundant positive flags in new configs. The candidate follows that recommendation; vinext's generator still emits `nodejs_compat`. Neither configuration implies full Node support. [Workers Node compatibility][node-compat]

For the later implementation, establish vinext dependencies and typed configuration before running generic framework autoconfiguration. cf's current override deliberately skips the incompatible OpenNext migration when it detects an installed vinext dependency in a Next project. Running `cf init` on untouched fx0 is not verified as a vinext initializer. Prefer manual, reviewable config derived from the current generator if `cf init` cannot select vinext, and report that mismatch instead of falling back to Wrangler. The upstream `vinext init --platform=cloudflare` is another documented setup mechanism, but was not run here because migration is outside this task. [cf detection][cf-vinext], [cf initializer behavior][cf-readme]

After setup, the intended commands are `cf dev`, `cf build`, and, only when deployment is authorized, `cf deploy --prebuilt` for the reviewed build output. `cf deploy --dry-run` is a future non-upload validation step, not an action performed here. cf build runs framework tooling and reads the Cloudflare Build Output; a plain Node-only vinext server build is not sufficient. Include `.cloudflare/types` in TypeScript configuration and generate bindings with `cf workers types`; replace the existing `next typegen`-dependent validation deliberately. Confirm cf delegates to Vite and emits Worker Build Output, rather than rerunning `next build`. [cf build implementation][cf-build], [package.json:10][package], [vinext type guidance][typed-config]

## Migration order and acceptance gates

1. **Resolve the tooling combination in an isolated prototype.** Pin vinext, React/React DOM/RSC peers, Vite 8, cf and plugin v2 beta on Node 24. Add typed configuration without creating Wrangler files. Confirm `cf dev` runs the RSC and SSR environments in workerd, `cf build` emits usable Cloudflare Build Output, and `cf deploy --dry-run` validates it without uploading. Record exact versions, bundle size and any source changes. This is the first gate; docs and the 95% scan alone do not pass it.
2. **Prove the retained UI with non-network fixtures.** Render `/` and `/login`, new draft and saved-project URLs, hydration, dynamic debug UI, theme persistence, Radix dialogs, mobile panes, source/export controls, fonts, CSS, icons, metadata, public assets and `NEXT_PUBLIC_*`. Test initial SSR and subsequent navigations. Replace the unverified partial-prefetch optimization with correct request-time rendering if necessary. Check two simultaneous accounts for account/chat data leakage and correct signout behavior.
3. **Fix runtime-specific utilities.** Read every catalog Markdown entry from production output without a checkout filesystem. Run URL-fetch fixtures covering private IPv4/IPv6, mapped addresses, redirects to private hosts, DNS changes, oversize and encoded bodies, timeouts and aborts. Do not weaken the existing SSRF properties to pass workerd. Exercise timers, crypto, cookie serialization and environment bindings. If shared caching remains, verify cache hits after a fresh isolate, expiration, failed-fetch behavior and bounded image sizes.
4. **Integrate selected backend replacements.** Follow the sibling libfx/provider, storage, identity and allowance decisions. Demonstrate a fake-model streamed turn with no real model billing, then cancellation, tab close, network loss and process interruption. The prior complete version must remain readable and retry must not duplicate admission or reserve unlimited funds. Ensure no unprotected `/api/libfx` remains and no Vercel credentials/services are required. Short `after` cleanup failures must not corrupt project state or falsely confirm revocation.
5. **Prove the Build/Drop contract separately.** Create a complete version with multiple HTML pages, shared external CSS/JS and valid relative links; preview navigation and assets must work. Edit a saved Build-origin project without changing the live site. Only explicit Publish sends the selected complete version to Drop. Failed generation/publish leaves the prior completed/published version intact. Shared login must use the agreed account protocol; ownership must prevent editing another client's project or importing arbitrary Drop sites.

Only after these gates should a staging deployment and production acceptance be proposed. This report authorizes neither. Remaining uncertainties are the unexercised plugin-v2/cf build combination, newest Next navigation parity, exact third-party dependency behavior in workerd, the safe replacement fetcher, persistent cache policy, and the sibling-owned service/provider/account decisions. Model and allowance/budget amounts remain open product choices.

## Primary sources and code references

[skill]: https://github.com/cloudflare/vinext/blob/cffccb6dbebc7eeb5d57849952887637060813e8/.agents/skills/migrate-to-vinext/SKILL.md
[framework]: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
[init]: https://github.com/cloudflare/vinext/blob/cffccb6dbebc7eeb5d57849952887637060813e8/packages/vinext/src/init.ts
[typed-config]: https://github.com/cloudflare/vinext/blob/cffccb6dbebc7eeb5d57849952887637060813e8/packages/vinext/src/init-cloudflare.ts#L455
[deploy]: https://github.com/cloudflare/vinext/blob/cffccb6dbebc7eeb5d57849952887637060813e8/packages/cloudflare/src/deploy.ts#L692
[cf-vinext]: https://github.com/cloudflare/cf/blob/7993e1d1b3d919d9726990c4801663181567e8e9/packages/cli/src/lib/vinext.ts
[cf-build]: https://github.com/cloudflare/cf/blob/7993e1d1b3d919d9726990c4801663181567e8e9/packages/cli/src/commands/build/index.ts
[cf-readme]: https://github.com/cloudflare/cf/blob/7993e1d1b3d919d9726990c4801663181567e8e9/packages/cli/README.md
[scanner]: https://github.com/cloudflare/vinext/blob/cffccb6dbebc7eeb5d57849952887637060813e8/packages/vinext/src/check.ts
[aliases]: https://github.com/cloudflare/vinext/blob/cffccb6dbebc7eeb5d57849952887637060813e8/packages/vinext/src/index.ts#L3243
[config]: https://github.com/cloudflare/vinext/blob/cffccb6dbebc7eeb5d57849952887637060813e8/packages/vinext/src/config/next-config.ts#L2090
[vinext-manifest]: https://registry.npmjs.org/vinext/1.3.0
[rsc-config]: https://github.com/cloudflare/vinext/blob/cffccb6dbebc7eeb5d57849952887637060813e8/README.md#custom-vite-configuration
[fonts]: https://github.com/cloudflare/vinext/blob/cffccb6dbebc7eeb5d57849952887637060813e8/packages/vinext/src/plugins/fonts.ts#L1205
[font-test]: https://github.com/cloudflare/vinext/blob/cffccb6dbebc7eeb5d57849952887637060813e8/tests/font-local-transform.test.ts#L50
[server]: https://github.com/cloudflare/vinext/blob/cffccb6dbebc7eeb5d57849952887637060813e8/packages/vinext/src/shims/server.ts#L1410
[cache-runtime]: https://github.com/cloudflare/vinext/blob/cffccb6dbebc7eeb5d57849952887637060813e8/packages/vinext/src/shims/cache-runtime.ts
[kv-adapter]: https://github.com/cloudflare/vinext/blob/cffccb6dbebc7eeb5d57849952887637060813e8/packages/cloudflare/src/cache/kv-data-adapter.ts
[externals]: https://github.com/cloudflare/vinext/blob/cffccb6dbebc7eeb5d57849952887637060813e8/packages/vinext/src/check.ts#L250
[next-partial]: https://nextjs.org/docs/app/api-reference/config/next-config-js/partialPrefetching
[next-static]: https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/ensureStatic
[node-compat]: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
[dns]: https://developers.cloudflare.com/workers/runtime-apis/nodejs/dns/
[http]: https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/#request
[fs]: https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/
[limits]: https://developers.cloudflare.com/workers/platform/limits/#duration
[vite-assets]: https://vite.dev/guide/features.html#glob-import
[botid]: https://vercel.com/docs/botid/get-started
[package]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/package.json#L23
[next-config]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/next.config.mjs#L1
[postcss]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/postcss.config.mjs#L1
[css]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/app/globals.css#L1
[layout]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/app/layout.tsx#L1
[page]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/app/page.tsx#L15
[chat-ui]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/components/chat-app.tsx#L31
[prompt]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/app/api/prompt/route.ts#L19
[events]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/app/api/events/route.ts#L5
[event-stream]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/lib/event-stream.ts#L7
[remote-cache]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/lib/remote-image-cache.ts#L1
[public-fetch]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/lib/public-fetch.ts#L35
[tools]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/lib/tools.ts#L137
[secure-session]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/lib/secure-session.ts#L1
[signout]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/app/api/auth/signout/route.ts#L15
[instrumentation]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/instrumentation-client.ts#L1
[trial]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/lib/trial.ts#L84
[auth]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/lib/auth.ts#L39
[auth-protocol]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/lib/auth-protocol.ts#L46
[credits]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/app/api/credits/route.ts#L14
[models]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/app/api/models/route.ts#L28
[accounts]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/lib/accounts.ts#L38
[journal]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/lib/journal.ts#L1
[draft-store]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/lib/draft-store.ts#L19
[assets]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/lib/design-assets.ts#L1
[libfx-route]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/app/api/libfx/route.ts#L1
[vercel]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/vercel.json#L4
[libfx-agent]: https://github.com/andreik6v/fx0/blob/d8295b4313b40fc01de8b18db4806b2f4538eebe/lib/libfx-agent.ts#L203
