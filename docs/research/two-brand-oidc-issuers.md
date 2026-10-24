# Drop as two OIDC issuers for one user database

Research date: 2026-10-24. Answers [Verify Drop's per-storefront OIDC issuers share one subject](/Users/andreichira/Downloads/projects/simplenet-build/.scratch/two-brand-build-drop/issues/07-per-storefront-oidc-issuers.md) for the accepted [same-brand journey](/Users/andreichira/Downloads/projects/simplenet-build/.scratch/two-brand-build-drop/issues/02-cross-brand-account-journeys.md). This is evidence, not an accepted design or an implementation.

## Verdict

The per-host issuer model holds with the pinned packages. One Drop deployment that builds Better Auth per request with `baseURL` set to the storefront origin acts as two separate, internally consistent OIDC issuers. Both issuers emit the same `sub`, which is the Drop `users.id`. One client with two redirect URIs works on both hosts. Drop can reject the other brand's redirect URI with the documented `validateRedirectUri` option. No alternative decision is needed.

There are three gaps. Drop has to close two of them and Build's client the third. They are listed under [Required conditions](#required-conditions). The main one: authorization codes and refresh tokens are not bound to the issuer that created them. Either Drop token endpoint redeems them and stamps its own `iss`. This is safe only because the client is confidential and Build always calls its paired issuer. A small Drop hook can enforce the binding instead.

## Evidence boundary

- Drop: read-only at `/Users/andreichira/Downloads/projects/astro/static-hosting-mvp`, branch `feature/storefronts`, commit `d431bd0c765c6684fd2094f221d3ee76e2f2d554` (on `origin/main`), clean tree. Portable links use [that commit](https://github.com/andreik6v/static-hosting/tree/d431bd0c765c6684fd2094f221d3ee76e2f2d554). Drop pins `better-auth` 1.7.7 with `better-call` 1.4.0, `@better-auth/core` 1.7.7, `@better-auth/utils` 0.4.2 and `@better-fetch/fetch` 1.3.2 installed. No OAuth provider package is installed.
- Provider: the npm tarball `@better-auth/oauth-provider@1.7.7`, unpacked outside both repos, and upstream source at tag [`v1.7.7`](https://github.com/better-auth/better-auth/tree/v1.7.7/packages/oauth-provider/src) (commit `db02f233918ad1233bf0753e437e1c0da353273d`). Dist line numbers below refer to the tarball's `dist/` files.
- Build: read-only at `/Users/andreichira/Downloads/projects/simplenet-build`, commit [`473ca98`](https://github.com/andreik6v/simplenet-build/tree/473ca984f1467f53c333a8b30a7feadeacca201b) (auth files unchanged at local `98ee97c`).
- Runtime: one local Node 26 script, [`two-brand-oidc-issuers-proof.mjs`](two-brand-oidc-issuers-proof.mjs), using the exact pinned package set, an in-memory adapter and Drop's per-request construction pattern. No Worker runtime, D1, Astro route, email login, network call, production call, deployment or repo modification.

## Which provider package

`@better-auth/oauth-provider` is the current and only option for `better-auth` 1.7.x. The in-core `oidcProvider` plugin was deprecated in 1.6 and removed in 1.7. The [1.7 upgrade guide](https://better-auth.com/docs/guides/1-7-upgrade-guide) says to "replace `oidcProvider` from `better-auth/plugins` with `oauthProvider` from `@better-auth/oauth-provider`" and to upgrade "`better-auth` and every `@better-auth/*` package together". The installed 1.7.7 `dist/plugins` directory has no `oidc-provider` or `mcp` plugin, and the current docs URL for `oidc-provider` returns 404.

Pin `@better-auth/oauth-provider` to **1.7.7**. Its peers are `better-auth ^1.7.7`, `@better-auth/core ^1.7.7`, and exactly `better-call 1.4.0`, `@better-auth/utils 0.4.2` and `@better-fetch/fetch 1.3.2` (`npm view @better-auth/oauth-provider@1.7.7 peerDependencies`). All of these match Drop's installed tree. In a fresh directory npm's resolver would not install `better-auth@1.7.7` and the provider together until those peer versions were pinned explicitly. Keep Drop's lockfile. The latest is 1.7.12; upgrading means moving the whole set together.

It requires the `jwt()` plugin for asymmetric ID tokens and a JWKS, plus schema for `jwks`, `oauthClient`, `oauthAccessToken`, `oauthRefreshToken`, `oauthConsent`, `oauthResource`, `oauthClientResource` and `oauthClientAssertion`.

## Findings

### Issuer and endpoints follow the host

With a static string `baseURL`, Better Auth sets `context.baseURL` to origin plus `basePath`, which defaults to `/api/auth` (`better-auth/dist/context/create-context.mjs:64,86`; `utils/url.mjs` `withPath`). Drop passes `baseURL: brand.origin` from `requestBrand(request)` and builds a fresh instance for each request ([`src/lib/auth.ts:17-28`](https://github.com/andreik6v/static-hosting/blob/d431bd0c765c6684fd2094f221d3ee76e2f2d554/src/lib/auth.ts#L17-L28)). Each storefront therefore gets its own issuer:

| | `drop.simplenet.ro` | `drop.kiravo.net` |
| --- | --- | --- |
| issuer (discovery, `iss` in ID token, `iss` authorization response parameter) | `https://drop.simplenet.ro/api/auth` | `https://drop.kiravo.net/api/auth` |
| discovery | `…/api/auth/.well-known/openid-configuration` | same path on Kiravo |
| authorize / token / JWKS | `…/api/auth/oauth2/authorize`, `…/oauth2/token`, `…/api/auth/jwks` | same paths on Kiravo |

Sources:

- Every metadata URL is built from `ctx.context.baseURL` ([`metadata.ts:25-45`](https://github.com/better-auth/better-auth/blob/v1.7.7/packages/oauth-provider/src/metadata.ts#L25-L45)).
- Every ID and access token sets `iss: jwt.issuer ?? ctx.context.baseURL` ([`token.ts:283,380`](https://github.com/better-auth/better-auth/blob/v1.7.7/packages/oauth-provider/src/token.ts#L380)).
- The authorization redirect adds `iss=getIssuer()` per RFC 9207 ([`authorize.ts:1062`](https://github.com/better-auth/better-auth/blob/v1.7.7/packages/oauth-provider/src/authorize.ts#L1062)).
- The plugin's `onRequest` serves `{issuerPath}/.well-known/openid-configuration` from the auth handler ([`oauth.ts:276-300`](https://github.com/better-auth/better-auth/blob/v1.7.7/packages/oauth-provider/src/oauth.ts#L276-L300)). The docs say "the issuer path is your basePath, such as `/api/auth`" ([OAuth provider docs](https://better-auth.com/docs/plugins/oauth-provider)).

Proof output: the two discovery documents each named their own host for every endpoint. ID tokens and authorization responses on each host carried that host's issuer. An exact-issuer `jwtVerify` against the other host's issuer failed in both directions.

The issuer is the `/api/auth` path, not the bare origin. OIDC Discovery appends `/.well-known/openid-configuration` to the issuer, so the document lives under the auth handler's path and is reachable once Drop's route allowlist admits it. Do not mount a root `/.well-known` route for this issuer. Do not set `jwt({ jwt: { issuer } })` to a fixed value, because that collapses both hosts into one issuer.

### `sub` is the Drop user ID on both hosts

`createIdToken` sets `sub = resolveSubjectIdentifier(user.id, client, opts)`. That function returns `user.id` unless the client is pairwise and a `pairwiseSecret` is configured ([`utils/index.ts:1031`](https://github.com/better-auth/better-auth/blob/v1.7.7/packages/oauth-provider/src/utils/index.ts#L1031)). JWT access tokens use `user.id` directly. `customIdTokenClaims` cannot override `sub`, `iss` or `aud`: they are stripped as reserved claims (`dist/introspect-CNR06Oy3.mjs:13-52`). Drop maps the Better Auth user model to `users`, whose `id` is the key referenced by `billing_accounts.owner_user_id` and site ownership ([`db/schema.sql:3`](https://github.com/andreik6v/static-hosting/blob/d431bd0c765c6684fd2094f221d3ee76e2f2d554/db/schema.sql#L3)). Proof output: one user signed up on Simplenet and signed in separately on Kiravo. Both ID tokens had `sub` equal to the stored user ID.

Keep the client `public` (the default). The registration code rejects a pairwise client whose redirect URIs span hosts ([`register.ts:491`](https://github.com/better-auth/better-auth/blob/v1.7.7/packages/oauth-provider/src/register.ts#L491)), and pairwise subjects would break the "same `sub`" rule anyway. Leave `pairwiseSecret` unset.

OIDC Core defines `sub` as unique only within an issuer. Treating the two issuers' subjects as one namespace is therefore a configured trust decision by Build, not something the protocol guarantees. It is correct here because both issuers are the same deployment and database. Build should record the owner as the Drop user ID and also keep `(iss, sub)` for audit, as the accepted decision already states.

### Signing keys are shared

The `jwt` plugin keeps one key table in the shared D1, not one per issuer. It signs with the newest live key, auto-minting EdDSA/Ed25519 if none exists, and encrypts private keys with the Better Auth secret (`better-auth/dist/plugins/jwt/sign.mjs:24-71`, `utils.mjs:40-60`). Both hosts serve the same JWKS; proof output: identical JWKS, one key row, same `kid` on both hosts' ID tokens. Shared keys are acceptable because each token's `iss` still differs. As a result, a JWKS match alone proves nothing about the brand: the client has to check `iss` exactly. Per-issuer keys are possible only through a custom `jwt({ adapter: { getJwks, createJwk } })` that filters by brand. That is unnecessary work for one authority.

### One client, two redirect URIs

A single client created with `adminCreateOAuthClient` with both Build callbacks, `skip_consent: true`, `client_secret_post` and `authorization_code` plus `refresh_token` completed the code+PKCE flow on each host with that host's callback. Built-in matching is exact string comparison against any registered URI, with only the port varying for loopback addresses ([`authorize.ts:306`](https://github.com/better-auth/better-auth/blob/v1.7.7/packages/oauth-provider/src/authorize.ts#L306)). Client creation requires an authenticated admin session (`dist/authorize-K1WHCNih.mjs:2167-2169`). Keep dynamic registration off, which is the default (`allowDynamicClientRegistration: false`). The docs suggest `cachedTrustedClients` for first-party clients ([docs](https://better-auth.com/docs/plugins/oauth-provider)).

### Rejecting the other brand's redirect URI

Built-in matching does not do this: a client's registered URIs are valid on every host. Proof output: without a hook, `drop.kiravo.net` redirected a code to `https://build.simplenet.ro/api/auth/callback`, carrying `iss=https://drop.kiravo.net/api/auth`.

The documented option `validateRedirectUri(redirectUri, registeredUris, defaultResult)` ([`types/index.ts:530-567`](https://github.com/better-auth/better-auth/blob/v1.7.7/packages/oauth-provider/src/types/index.ts#L530-L567)) does the job. It replaces the built-in result entirely, so the hook must AND it in: `defaultResult && new URL(uri).origin === brand.pairedBuildOrigin`. It runs inside `authorizeEndpoint` ([`authorize.ts:603`](https://github.com/better-auth/better-auth/blob/v1.7.7/packages/oauth-provider/src/authorize.ts#L603)). That covers the direct request and the post-login continuation, which re-enters the same function from the sign-in after-hook ([`oauth.ts:718`](https://github.com/better-auth/better-auth/blob/v1.7.7/packages/oauth-provider/src/oauth.ts#L718)). It also controls whether error responses may be sent to the URI ([`authorize.ts:372`](https://github.com/better-auth/better-auth/blob/v1.7.7/packages/oauth-provider/src/authorize.ts#L372)). Proof output: with the hook, the same Kiravo request ended at `https://drop.kiravo.net/api/auth/error?error=invalid_redirect` and issued no code.

The callback receives no request or context. It knows the authorization host only because Drop builds a new instance per request and the closure captures `brand`. That is Drop's current, deliberate pattern, but the guarantee depends on it. If Drop ever moves to one shared instance with `baseURL: { allowedHosts }`, the hook loses the host. A `hooks.before` matcher on `/oauth2/authorize` would not replace it, because the continuation runs under the sign-in path. Pin this with a test.

### Behavior that holds only by implementation detail

1. **Codes and refresh tokens are not issuer-bound.** Codes live in the shared `verification` table. The token endpoint checks client, exact `redirect_uri` and PKCE, but not which host created the code ([`token.ts:1361-1430`](https://github.com/better-auth/better-auth/blob/v1.7.7/packages/oauth-provider/src/token.ts#L1361-L1430)). Refresh tokens are checked only against `clientId`. Proof output: a code created on Simplenet was redeemed at Kiravo's token endpoint, and a Simplenet refresh token was refreshed at Kiravo, each returning an ID token with `iss=https://drop.kiravo.net/api/auth`. Exploiting this needs the confidential client secret, and Build's exact per-host issuer check would reject the resulting ID token. Still, the binding is client discipline, not provider enforcement.
2. **Issuer string equality.** Metadata passes the issuer through `validateIssuerUrl`, which forces `https` on non-loopback hosts and strips a trailing slash. Tokens use raw `ctx.context.baseURL` ([`authorize.ts:188-220`](https://github.com/better-auth/better-auth/blob/v1.7.7/packages/oauth-provider/src/authorize.ts#L188-L220) vs `token.ts:380`). The two agree only because Drop's `normalizeOrigin` admits HTTPS origins without a path ([`src/lib/brands.ts:31`](https://github.com/andreik6v/static-hosting/blob/d431bd0c765c6684fd2094f221d3ee76e2f2d554/src/lib/brands.ts#L31)). A non-loopback `http:` development host would advertise one issuer and sign with another.
3. **Unknown hosts fall back to Simplenet.** In production, `requestBrand` returns the canonical Simplenet brand for an unconfigured host ([`src/lib/brands.ts:101-108`](https://github.com/andreik6v/static-hosting/blob/d431bd0c765c6684fd2094f221d3ee76e2f2d554/src/lib/brands.ts#L101-L108)). With `KIRAVO_ORIGIN` unset, a request routed to `drop.kiravo.net` would serve the Simplenet issuer and could mint Simplenet-issued codes. Build's pairing would fail closed, but the [storefront contract](/Users/andreichira/Downloads/projects/simplenet-build/.scratch/two-brand-build-drop/issues/01-deployment-and-storefront-contract.md) says unknown or disabled hosts must not mint credentials.
4. **Resource-server helper defaults are wrong for this layout.** `oauthProviderResourceClient` takes the default issuer from `auth.options.baseURL`, which is the bare origin after init (`https://drop.kiravo.net`, checked locally). It builds the JWKS URL from `options.basePath`, which Drop leaves unset ([`client-resource.ts:60-95`](https://github.com/better-auth/better-auth/blob/v1.7.7/packages/oauth-provider/src/client-resource.ts#L60-L95)). Tokens actually say `…/api/auth`. Any Drop integration API that verifies Build's access tokens must pass `verifyOptions.issuer`, `audience` and `jwksUrl` explicitly.
5. **Login continuation is not automatic for Drop's custom login.** The plugin continues authorization when a response sets a session cookie and the request body carried the signed `oauth_query` ([`oauth.ts:680-718`](https://github.com/better-auth/better-auth/blob/v1.7.7/packages/oauth-provider/src/oauth.ts#L680-L718)). Drop's wrappers rebuild the OTP body as `{email, otp}` and verify magic links with a GET built in [`confirm.ts`](https://github.com/andreik6v/static-hosting/blob/d431bd0c765c6684fd2094f221d3ee76e2f2d554/src/pages/api/auth/confirm.ts#L23), so `oauth_query` is dropped. Its route allowlist exposes no OAuth or discovery path ([`[...all].ts:12`](https://github.com/andreik6v/static-hosting/blob/d431bd0c765c6684fd2094f221d3ee76e2f2d554/src/pages/api/auth/%5B...all%5D.ts#L12)). This affects how the flow returns to Build, not issuer correctness. Drop must either forward the signed query or send the browser back to the authorize URL after login; the authorize endpoint re-runs `validateRedirectUri` either way.

### Build's client can enforce an exact paired allowlist

Build has no Drop client yet. It has a hand-written fixed-issuer OIDC client for Vercel using `jose` 6.2.12:

- state, nonce and PKCE are kept in a sealed flow cookie ([`app/api/auth/signin/route.ts`](https://github.com/andreik6v/simplenet-build/blob/473ca984f1467f53c333a8b30a7feadeacca201b/app/api/auth/signin/route.ts));
- the code is exchanged at a constant token endpoint ([`callback/route.ts:29-35`](https://github.com/andreik6v/simplenet-build/blob/473ca984f1467f53c333a8b30a7feadeacca201b/app/api/auth/callback/route.ts#L29-L35));
- tokens are verified by `jwtVerify` with one fixed `issuer`, `audience`, `algorithms: ['RS256']` and required claims ([`lib/auth-protocol.ts:97-104`](https://github.com/andreik6v/simplenet-build/blob/473ca984f1467f53c333a8b30a7feadeacca201b/lib/auth-protocol.ts#L97-L104)).

The prior plan calls for Build to keep this shape ([spec](/Users/andreichira/Downloads/projects/simplenet-build/.scratch/fx0-cloudflare-multipage/spec.md), "first-party OIDC client"). No other OIDC library is needed. The shape supports exact pairing directly:

- A constant table keyed by Build host (`build.simplenet.ro` → `https://drop.simplenet.ro/api/auth`, `build.kiravo.net` → `https://drop.kiravo.net/api/auth`) with authorize/token/JWKS URLs configured, not discovered at runtime. An unknown or disabled host gets no table entry and therefore fails closed.
- Store the expected issuer in the sealed flow. On callback require `flow.issuer === table[host].issuer`, require the `iss` query parameter to equal it (RFC 9207, advertised as `authorization_response_iss_parameter_supported: true`), and exchange only at that issuer's token endpoint with that host's `redirect_uri`.
- `jwtVerify(idToken, jwksFor(issuer), { issuer, audience: clientId, algorithms: ['EdDSA'] })` with a single string issuer, not an array. One `createRemoteJWKSet` per issuer is fine; the key sets are identical.
- Refresh only at the issuer recorded with the grant.

Required changes: `algorithms` must become `['EdDSA']` (or Drop must configure `jwt({ jwks: { keyPairConfig: { alg: 'RS256' } } })`), and `requestOrigin` must change from one `APP_URL` to the two-host allowlist.

## Required conditions

To Drop's provider integration:

1. Install `@better-auth/oauth-provider@1.7.7` and `jwt()`. Keep per-request construction with `baseURL: brand.origin`. Do not set a fixed `jwt.issuer`, `pairwiseSecret` or dynamic `baseURL`.
2. Configure `validateRedirectUri: (uri, _, ok) => ok && new URL(uri).origin === brand.pairedBuildOrigin`.
3. Reject OAuth and discovery routes when `brandForHost(host)` is undefined, instead of falling back to Simplenet.
4. Recommended hardening for finding 1: an `options.hooks.before` on path `/oauth2/token` that rejects `grant_type=authorization_code` unless `redirect_uri`'s origin is the current brand's paired Build origin. This makes the code-to-issuer binding enforceable. Refresh tokens cannot be bound without a custom column or table, so they stay client discipline: Build refreshes only at the issuer recorded with the grant.
5. Allowlist exactly the needed handler paths: `.well-known/openid-configuration`, `oauth2/authorize`, `oauth2/token`, `jwks`, plus `oauth2/revoke` or `oauth2/introspect` if used. Do not expose the `jwt` plugin's `/token` session endpoint or the client-admin endpoints.
6. Verify integration access tokens with explicit issuer, audience and JWKS URL (finding 4).

To Build's client: the paired table, the `iss` response-parameter check, the EdDSA algorithm and the two-host origin allowlist described above.

## Needs a runtime check during implementation

- Ed25519 key generation, JWK import, and EdDSA signing and verification under workerd for Drop and for Build. Cloudflare's [Web Crypto table](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/) lists Ed25519 sign/verify/generate/import/export, but this was not run in workerd.
- The provider's routes through Drop's Astro catch-all with D1 schema migrations, including the `/api/auth/.well-known/openid-configuration` path.
- Concurrent first-use key minting on both hosts. Expect possibly two keys, both published; harmless.
- Login continuation through Drop's OTP and magic-link wrappers back to the initiating Build callback, plus reuse of an active same-brand session without an email.
- Build-to-Drop server fetches for token and JWKS. Same-zone `fetch()` to another Worker succeeds only if the target is a Custom Domain, not a route ([Cloudflare custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)). `drop.simplenet.ro` is a Custom Domain in [`wrangler.jsonc:10`](https://github.com/andreik6v/static-hosting/blob/d431bd0c765c6684fd2094f221d3ee76e2f2d554/wrangler.jsonc#L10). `drop.kiravo.net` must be one as well, or a service binding must be used.
- Acceptance tests from the accepted decision: cross-brand `redirect_uri` rejected, unknown issuer rejected, disabled Kiravo host mints nothing, same `sub` after Simplenet signup and Kiravo sign-in.

## If the model had failed

It did not. If a runtime check above fails, the smallest decision to bring back is a **single canonical issuer**. Pin `jwt.issuer` and all endpoints to one origin, for example `drop.simplenet.ro`, and keep both Build callbacks. That reverses the accepted same-brand authorization journey for Kiravo, so it is a product decision, not a silent substitution.
