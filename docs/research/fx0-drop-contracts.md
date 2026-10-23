# Build and Drop account, preview, and publication contracts

Research date: 2026-10-23. This answers the full question in the canonical [Drop integration feasibility ticket](/Users/andreichira/Downloads/projects/fx0/.scratch/fx0-cloudflare-multipage/issues/03-drop-integration-feasibility.md:1). It is evidence for subsequent decisions, not an accepted architecture or implementation.

## Recommendation

Keep Build and Drop as separate applications on ordinary Workers. Keep projects, conversations, complete site versions, generation allowance, and private draft previews in Build. Send a frozen site version to Drop after the client chooses Publish. Reuse Drop's hosting entitlement, domain routing, content-addressed upload, candidate publication, and restoration logic behind a new owner-authorized integration API.

Use one identity authority. The smallest standard arrangement is to make Drop's existing account service the authority and register Build as its only first-party OIDC client. Each application keeps its own host-scoped session. A separate identity Worker can follow later if its operational independence is valuable. Neither shared account databases nor shared parent-domain cookies are necessary.

A service binding is suitable transport for Build's server calls to Drop. It does not prove which client authorized a publication. Drop must validate a user-delegated credential, site ownership, Build-origin linkage, and current hosting entitlement on every relevant operation. Add durable operation IDs and a monotonic publication revision before relying on retries or editing a site that can also change in Drop.

This recommendation meets the confirmed scope: static HTML pages and shared CSS/JS, one model with the tab open, saved projects and versions, last completed version plus retry after interruption, public signup with capped Simplenet-funded generation, Build-origin hosted-site editing, and explicit publication. It requires no customer server code, arbitrary builds, or Workers for Platforms. Model, allowance, spending cap, retention amounts, and exhausted-allowance behavior remain undecided. The [canonical map](/Users/andreichira/Downloads/projects/fx0/.scratch/fx0-cloudflare-multipage/map.md:1) and [glossary](/Users/andreichira/Downloads/projects/fx0/GLOSSARY.md:1) define those constraints.

## Evidence boundary

Drop was inspected read-only at `/Users/andreichira/Downloads/projects/astro/static-hosting-mvp`, commit `51717529f7bb523df6df99c10ff447bf70db12ba`, with a clean tracked and untracked working tree. Source links below point to local files and line numbers at that snapshot. Portable source baseline: [Drop commit](https://github.com/andreik6v/static-hosting/commit/51717529f7bb523df6df99c10ff447bf70db12ba). Build's isolated checkout started at fx0 commit `d8295b4313b40fc01de8b18db4806b2f4538eebe`.

I first read Drop's `AGENTS.md`, `docs/agents/domain.md`, `CONTEXT.md`, and all three ADRs. The accepted decisions require direct claim navigation, payment before domain setup, and site-scoped content-addressed deployments. The integration proposed here preserves them. Drop's current glossary describes a Drop account as separate from Simplenet accounts. One account across Build and Drop is a new product requirement, so that description needs an explicit update when the account decision is accepted. [Domain context][context], [claim ADR][adr1], [payment ADR][adr2], [deployment ADR][adr3].

“Verified” below means verified in source or primary documentation. Existing tests were read, not executed. Proposed routes, scopes, database fields, and preview grants are recommendations. No end-to-end integration, vinext compatibility, deployed configuration, or production behavior was tested.

## Existing Drop contracts

### Anonymous publication, keys, and claims

| Contract | Verified behavior | Fit for Build |
| --- | --- | --- |
| `POST /api/v1/sites` | Raw `application/zip`; ignores session cookies and creates an anonymous preview. Returns `siteId`, `previewUrl`, `expiresAt`, `skippedFiles`, `associated`, one-time-returned `siteKey`, and a separate `claimUrl`. | Useful for anonymous agent sharing. It cannot directly establish Build account ownership. |
| `PUT /api/v1/sites/{id}` | Requires `Authorization: Bearer {siteKey}` and another complete ZIP. Updates the same preview URL and original deadline. | Only temporary previews. It cannot update permanent hosting. |
| `POST /mcp` | `publish_site` and `update_site` wrap the same preview lifecycle. Text and base64 files are packed into a ZIP for validation. | No owner session or permanent-publication authority. Build need not call MCP. |
| `POST /api/sites/{id}/claim` | Requires a verified Drop session, exact same Origin, and a matching upload-cookie or claim-link proof. Associates only an available unowned preview. | Existing browser handoff, not SSO or an integration authorization grant. |
| `POST /api/sites/{id}/revoke-key` | Verified owner session and same Origin clear `site_key_hash`. | Claiming alone does not revoke the agent's update key. |

Sources: [HTTP creation][api-create], [HTTP update][api-update], [agent implementation][agent], [MCP][mcp], [claim route][claim], [association SQL][account-sites], [key revocation][revoke].

The ZIP and decompressed preview are limited to 25 MiB and 100 files. Root `index.html` is required after optional wrapper-folder removal. Validation normalizes paths, rejects traversal and duplicates, and skips unsupported or hidden tool files. HTML, CSS, JS, JSON, images, fonts, and other listed static assets are accepted. These are hosting limits, not an accepted Build page allowance. [Limits][limits], [archive validation][archive].

The public HTTP creation channel shares five upload attempts per IP per fixed clock hour with the browser upload form. The counter is consumed before archive validation. MCP creation uses a global 300/hour counter and permits 5 MiB of decoded file contents, despite user-facing “5 MB” wording. A valid update key uses 30 updates per site per fixed hour; a wrong key spends the originating channel's budget. These are different counters, not interchangeable quotas. Paid replacement starts have another limit, five per user per hour, and owner API requests have a sites-category limit of 120/minute. Blob parts also pass through that request limiter. [Rate windows][rate], [agent counters][agent], [numeric limits][limits], [replacement starts][replacements], [owner request limiter][billing-http].

The preview deadline is fixed at creation plus 3,600 seconds. Claiming and agent updates do not renew it. Updates require more than 60 seconds remaining and reject any site already present in `published_sites`. A per-site upload lease serializes updates, and a failed update leaves the previous completed deployment available. [Creation and update lifecycle][create-preview], especially `src/lib/create-preview.ts:138-192`.

`siteKey` and claim secret are independent random secrets, stored as hashes. The claim secret is returned in `/asociaza/{id}#cheie={secret}`. The fragment avoids server request logs and Referer transmission; the claim page subsequently establishes a host-scoped claim cookie. Association requires login, consumes claim ownership proof, and does not extend the preview. A claimed preview's agent key remains useful until revoked, expired, or permanently published. A site key is therefore neither a client identity nor a permanent-hosting credential. [Agent secrets][agent], [ownership cookies][ownership], [claim and association][claim], [association SQL][account-sites].

Build should not spoof `CF-Connecting-IP` or use MCP's global budget to work around these limits. A dedicated owner API should apply explicit account and application limits. A server-to-server IP is not a reliable generation-account identifier.

### Authentication and account boundary

Drop pins Better Auth 1.7.7. It uses D1-backed magic-link and email-OTP login, ten-minute login proofs, seven-day sessions, disabled session-cookie caching, the `drop` cookie prefix, and `crossSubDomainCookies.enabled=false`. Account linking is disabled. The middleware resolves only Drop session cookies into `locals.user`. The auth route allowlist exposes login, logout, session revocation, and session lookup; it exposes no OAuth provider or cross-app handoff endpoints. Login redirects are restricted to `/cont` and its claim query. Simply adding a plugin would not make its routes reachable. [Auth configuration][auth], [auth route][auth-route], [middleware][middleware].

The owner routes call `protectedBilling`, which requires exact request Origin and a verified session before rate limiting and business logic. Adding Build to a CORS list or sending a synthetic `Origin: https://drop.simplenet.ro` does not supply that session or grant authority. Preserve this browser contract. Add a separate token-authenticated integration boundary rather than weakening every existing route. [Origin helper][auth], [owner guard][billing-http].

### First permanent publication and billing

`POST /api/sites/{id}/publish` invokes `publishSite`. Drop checks active paid hosting and available capacity, reserves the owned preview's files, allocates a site slot, and promotes a deployment to `s-{siteId}.{SITES_BASE_DOMAIN}`. Existing live publication has some retry tolerance, returning its URL, but this is not a general operation-id contract. A file hold protects a selected preview during checkout without extending its public preview link. Configured hold duration must be between 3,900 and 86,400 seconds. [Publish route][publish-route], [publishing][publishing], [slot allocation][billing].

Checkout may name a target site. Confirmed payment can then call `fulfillCheckoutForUser` and publish that site automatically. Payment is therefore capable of completing an earlier publication intent; it is not merely an allowance refresh. Build must freeze the selected version and record explicit Publish consent before using that flow. Never let payment completion select whatever working draft exists later. For the smallest alternative, link to account billing without a target site, then have the client return and choose Publish. [Checkout route][checkout], `src/lib/stripe.ts:108-129`, and [fulfillment][publishing] at `src/lib/publishing.ts:62-83`.

Drop's configured production app enables billing and live Stripe mode, but this research did not inspect the deployed environment or contact Stripe. Source-level entitlement requires an active subscription with `paid_through` in the future. Slot allocation counts and inserts atomically. Paid asset routing independently checks owner, subscription, paid-through date, site status, live state, and deployment readiness. A cached hostname lookup cannot grant unpaid hosting. Build-funded inference must remain separate from this hosting entitlement. [Configuration][app-config], [billing][billing], [serving checks][serve-routing].

### Permanent replacement, candidate publication, and restoration

The existing owner protocol is reusable internally:

1. `POST /api/sites/{id}/replace` with `{action:"start", files:[{path,hash,size}]}` validates a complete manifest, ownership, paid eligibility, and limits. It acquires a 15-minute upload lease and returns `{upload, missing, partBytes}`.
2. `PUT /api/sites/{id}/replace?upload=...&hash=...&part=...` sends missing file bodies in 1-based parts of at most 5 MiB. Drop verifies sizes and SHA-256 before registering the blob. File parts extend the lease. Hash existence is scoped to the site.
3. `POST .../replace` with `{action:"complete", upload}` checks every manifest entry has a verified blob. It creates the site's sole unpublished candidate, with a `v-{token}` URL and a 24-hour deadline. It does not change live content. A new completed upload replaces the previous candidate.
4. `POST /api/sites/{id}/candidate?version={reviewedToken}` makes that candidate live. `DELETE` discards the matching candidate. `DELETE .../replace?upload=...` cancels an upload.

Paid versions allow 1,000 files and 500,000,000 bytes. Hashes deduplicate within a site, not across clients. Only changed blobs need upload; old manifests and blobs remain for retained versions. Every upload step requires an eligible owned published site. [Replacement route][replace-route], [replacement implementation][replacements], [candidate route][candidate-route], [ownership checks][ownership], [deployment ADR][adr3].

Candidate links are public bearer-discovery links, not authenticated private previews. They require active hosting to serve, but a visitor with the URL needs no owner login. Candidate responses are unindexed, revalidate, and use only `frame-ancestors` CSP. They do not inherit the temporary preview's restrictions on forms, connections, scripts, and embeds. [Candidate routing][serve-routing], [response headers][serve-headers].

Restoration uses `POST /api/sites/{id}/restore` with `{deploymentId}`. It requires an eligible owner, selects a retained superseded deployment, and atomically switches the live pointer. Drop retains the live deployment plus two alternatives; cron prunes older versions and expired candidates. Candidates are excluded from restoration history. Build must keep its own saved versions instead of treating this short hosting history as project storage. [Restore route][restore-route], [version logic][versions], [cleanup][cleanup].

### Existing conflict and retry guarantees stop short of the required contract

Drop's `switchLive` compares the current live pointer during its transaction, checks target status and paid ownership, and returns conflict if the pointer changes during that operation. Candidate publication also compares the reviewed candidate token. These guards preserve storage consistency and reject a replaced candidate. [Version switching][versions] at `src/lib/versions.ts:67-94,123-145`.

However, `publishCandidate` reads the live pointer at publication time. It does not receive the live revision the client originally reviewed. A client can review a candidate, restore another version in Drop, and then publish the old candidate successfully. The existing test explicitly expects that result. This is current behavior, not a failing test discovered here. A deployment ID alone also misses an A-to-B-to-A history of changes. [Source assertion][candidate-tests] at `tests/http/candidate-versions.test.ts:112-126`.

Blob uploads tolerate repeated already-stored data. A repeated completion after success no longer finds a receiving upload; a repeated candidate publish no longer finds that candidate. Creation assigns fresh random site IDs. There is no Build project-origin mapping, general publication operation ledger, or monotonic publication revision in the inspected schema. Stripe has its own idempotency keys, which do not deduplicate site creation or version publication. [Completion lifecycle][replacements], [version lifecycle][versions], [schema][schema].

## One account and narrowly delegated calls

### Supported choices

| Choice | Benefit | Cost and recommendation |
| --- | --- | --- |
| Drop is the identity authority; Build is a fixed OIDC client | Preserves existing Drop users and billing owner IDs; standard browser redirects and app-local sessions; no third deployment required. | Recommended. Requires provider routes, schema, login continuation, and token validation, none of which exist today. |
| A separate shared identity Worker; both apps are clients | Independent identity deployment and clear long-term ownership. | Viable, but adds account mapping and migration. Preserve a stable issuer/subject-to-Drop-user mapping; do not recreate billing owners from email. Choose only if that independence is wanted now. |
| Fixed-client one-time login handoff | Can keep Drop's present login UI and issue a Build-only local session. | Smaller endpoint count, but audience, callback binding, session revocation, CSRF, expiry, and publication delegation become custom protocol work. Not an automatic shortcut to a safe integration. |
| Cross-subdomain cookies and a shared session store | Better Auth supports explicitly configured parent-domain cookies. | Rejected for this scope. It couples credentials and cookie settings across apps and untrusted sibling hosts, and supplies no site-specific publication checks. |

Better Auth's official provider plugin supports authorization-code flow, OIDC identity, resource-bound access tokens, introspection, revocation, and registered clients. It is a separate `@better-auth/oauth-provider` package, needs schema additions, and requires discovery routes to reach the handler. These are documented capabilities, not verified compatibility with Drop's pinned 1.7.7. The current docs advertise 1.7.12. Pin and test a matched version before implementation. [OAuth provider documentation](https://better-auth.com/docs/plugins/oauth-provider).

For the recommended design, register a single confidential Build server client, exact HTTPS callback URLs, authorization code plus S256 PKCE, and a state value tied to the initiating Build session. Validate OIDC nonce and issuer. Store identity by issuer plus subject; preserve Drop's canonical user ID through an explicit mapping if needed. Use server-held access tokens with a Drop integration resource audience and small scopes, for example `build:sites:read`, `build:sites:stage`, and `build:sites:publish`. These names are proposed. Identity ID tokens are for login, not publication API access. Disable dynamic client registration and machine client-credentials publication. Exact redirect matching and PKCE follow [OAuth security best practice](https://datatracker.ietf.org/doc/html/rfc9700). Resource audience and scope configuration are supported by the [provider's resource contract](https://better-auth.com/docs/plugins/oauth-provider#resources).

Keep tokens out of generated files, model prompts, preview messages, and browser storage. Build's browser receives its own opaque HttpOnly session cookie. Build's server resolves that session and calls Drop with the owner's delegated credential. Drop checks issuer, audience, expiry, client authorization, and required scope, then resolves the canonical owner and validates site linkage. Introspection or an authoritative grant check is needed for immediate disconnect; a locally verified JWT can otherwise remain valid until expiry. Define logout separately from “disconnect Build” and “revoke all sessions.” These are recommended lifecycle rules, not current Drop behavior.

The simpler Better Auth OTT plugin creates a single-use token tied to an existing session and normally expires it in three minutes. Its installed implementation stores the original session token behind that token, returns the session on redemption, and sets a session cookie unless disabled. Its verification input is only `{token}`. It supplies no fixed-client audience, PKCE challenge, callback binding, or publication scope. Do not forward its raw result to the Build browser or treat it as an owner publication grant. A constrained wrapper must redeem server-side, return only a stable identity to Build, bind a single-use login transaction to Build's callback and browser, and issue a distinct scoped grant for publications. That custom work weakens the apparent size advantage. [OTT documentation](https://better-auth.com/docs/plugins/one-time-token), [installed 1.7.7 implementation][ott].

Better Auth documents cross-subdomain cookies as opt-in and warns about untrusted subdomains. Keep them disabled. Build and Drop should use separate host-only Secure/HttpOnly cookies and app-specific keys. Generated content belongs on a different origin, preferably a different registrable domain from either app. [Cookie documentation](https://better-auth.com/docs/concepts/cookies).

### Worker transport

Cloudflare service bindings support both HTTP requests and named RPC entrypoints between ordinary Workers. An HTTP binding can call Drop's existing Astro fetch handler with a new token-authenticated route. This is the least adapter-specific starting point. Construct an absolute request URL and pass the delegated token, operation ID, and validated operation payload. Do not copy browser Cookie or Origin headers to manufacture a Drop browser session. [Service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/), [HTTP binding contract](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/http/).

A binding to Drop's default public fetch handler does not make a route private. Secure that route identically if reached over the public hostname. If strictly binding-only exposure is desired, use a dedicated named entrypoint or an internal adapter Worker, then test the Astro build's export and routing behavior. Named RPC methods are an explicit capability boundary, but still need user, ownership, and entitlement checks. Export only the integration methods, never general SQL, bucket access, arbitrary user impersonation, or a payment override. [RPC entrypoints](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/), [RPC visibility and security](https://developers.cloudflare.com/workers/runtime-apis/rpc/visibility/).

Build receives no binding to Drop's DB or R2 bucket. Drop remains the writer of its ownership, billing, hosting, and domain records. A method accepting caller-supplied `{userId}` plus possession of the binding would grant excessive impersonation authority.

## Editor previews

### Reusing Drop previews versus a Build-owned preview origin

| Concern | Existing Drop temporary preview | Separate Build private static preview |
| --- | --- | --- |
| Access | Public URL, no authentication. Unindexed does not mean private. | Authenticate access to a completed version through a narrowly scoped preview grant. |
| Lifetime | Fixed 60 minutes; updates and claims do not renew it; updates stop in the last minute. | Preview grant expiry can be independent of durable saved-version retention. Mint a new grant after expiry. |
| Editing | Full ZIP on every update; 30/site/hour; 25 MiB and 100 files. Permanent sites reject site-key updates. | Reads Build's saved file tree, no hosting publication or agent update budget per edit. |
| Embedding | Production `PREVIEW_FRAME_ANCESTORS` allows only `https://drop.simplenet.ro`. Adding Build is required. | Exact Build origin in response CSP; no change to Drop's sites Worker needed. |
| URL stability | `p-{id}` is a mutable preview. Old pages/assets can remain in a browser cache for up to 60 seconds. | Each complete version has its own origin or version identity. Never mix a partial generation with completed files. |
| Paid candidate | Public, one/site, 24 hours, active hosting required. Another upload replaces it. | Works before purchase and retains multiple Build versions independently. |
| Work required | Fewest lines for a disposable public demo, then new ownership, expiry, and privacy exceptions for normal editor use. | An authenticated file-serving Worker and browser validation. Clearer ownership and lifetime rules for saved projects. |

Verified Drop details: [preview lifecycle][create-preview], [embedding configuration][sites-config], [headers][serve-headers], [candidate routing][serve-routing].

Recommend the Build-owned origin. It is smaller in product rules, not necessarily in initial code. Reusing Drop only wins if the accepted product is a public one-hour disposable preview. Making that API into private durable draft storage would change its current domain contract and still leave Build needing saved versions.

Private R2 storage plus an ordinary Worker can serve the files without a Worker deployment per site. R2 buckets are private by default, and Workers can read bodies through bindings. Keep public bucket and `r2.dev` access disabled. The preview Worker implements authorization before file reads; the bucket alone does not authenticate viewers. [R2 access model](https://developers.cloudflare.com/r2/buckets/public-buckets/), [Workers R2 API](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/).

### Proposed preview contract

- Give each immutable completed site version a fresh hostname on a content-only domain, for example `v-{opaqueVersion}.{previewDomain}`. The identifier routes content; it is not an authorization secret. Each version hostname has only that version's preview credential. Never serve generated HTML from Build's account origin, including via `srcdoc` with relaxed sandbox settings.
- Build authorizes the owner and issues a short-lived, one-use launch grant restricted to the project, version, and preview hostname. A trusted bootstrap page on that hostname receives it through `postMessage` with exact origin, expected window, schema, and nonce checks, before generated content is loaded. It exchanges it for a version-only host cookie. Do not send Build/Drop login cookies, access tokens, or model credentials to this origin. Exact receiver/sender checks follow the [HTML messaging security rules](https://html.spec.whatwg.org/multipage/web-messaging.html#security-postmsg).
- For cross-site embedding, evaluate a `__Host-` Secure, HttpOnly, `SameSite=None; Partitioned` preview cookie. CHIPS partitions cookies by the top-level site. That avoids depending on unrestricted third-party account cookies, but is not an end-to-end compatibility finding. Test the chosen browsers and blocked-cookie modes. If authentication fails, fail closed and offer a separately authenticated top-level preview flow. Do not silently turn the URL into public access. [Chrome's partitioned-cookie model](https://privacysandbox.google.com/cookies/chips).
- Use a cross-origin sandboxed iframe. Allow scripts and, where module/fetch behavior requires it, the preview's own origin; omit top navigation, popups, forms, and downloads by default. `allow-scripts` plus `allow-same-origin` must never be used for content sharing Build's origin. Forbid generated service workers initially, constrain CSP, and set `frame-ancestors` to the exact Build origin. A per-version origin also limits storage contamination across projects. The [HTML iframe contract](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox) explains the sandbox restrictions.
- Serve `/index.html`, `/about.html`, nested pages, shared CSS/JS, fonts, and images from the version's root. A root-relative `/assets/site.css` must resolve within that version. Avoid a bearer token in a query string: ordinary HTML links and CSS references will not propagate it safely. A path prefix would similarly need rewriting for root-relative links. Preserve page-relative links and `url(...)` paths. Match Drop's clean-URL handling and directory slash redirects if the generator emits them. [Current Drop path behavior][serve-routing] at `sites-worker/src/index.ts:247-250,301-314`.
- Authorize every document and asset request, including HEAD, range, and conditional requests. Start with `Cache-Control: private, no-store`, no public CDN caching, no indexable responses, and `Referrer-Policy: no-referrer`. Authentication must run before any 304 or cached-body return. Revoke grants on project deletion and explicit access revocation; expired grants must not erase saved versions. Do not use KV as the sole immediate revocation authority: it is eventually consistent and cached changes can take 60 seconds or more. [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/).

This design isolates account credentials; it cannot stop generated JavaScript from transmitting the content it is allowed to read if external scripts or network egress are permitted. Self-contained assets and restrictive preview CSP reduce that exposure. External-image, font, script, and embed behavior needs an explicit preview policy. Drop temporary previews already allow remote HTTPS images/scripts/styles but restrict forms and connections; paid candidates and live sites behave differently. Test that distinction instead of promising identical preview and live behavior. [Current policies][serve-headers].

The bootstrap, cookie, sandbox, module loading, nested-page navigation, grant revocation, and top-level fallback are untested design assumptions. A browser proof is a prerequisite for accepting “private preview,” not evidence that the capability already exists.

## Proposed integration API and ownership

The following exact route shapes are a recommended contract to agree before implementation. None currently exists. They are HTTP operations over a service binding, or equivalent narrowly named RPC methods. New integration authentication derives the canonical owner from a valid delegated access token. It never accepts a client-selected owner ID. Every route verifies the registered Build client and origin linkage.

For the initial ZIP request, use `Content-Type: application/zip` with bounded `X-Build-Project-Id`, `X-Build-Version-Id`, and `X-Build-Artifact-Digest` metadata headers plus `Idempotency-Key`. Other operation bodies are JSON except raw blob parts. Define the artifact digest over a canonical sorted manifest of normalized paths, sizes, and file SHA-256 hashes, not ZIP packaging bytes. Drop recomputes it from the validated files. The headers identify a request; they do not grant ownership. Version the canonicalization rules as part of this API.

| Proposed Drop endpoint | Required behavior |
| --- | --- |
| `POST /api/build/v1/sites` | Stage a frozen Build version for first publication. Metadata identifies `projectId`, `buildVersionId`, and `artifactDigest`; the artifact is a ZIP. A dedicated `Idempotency-Key` returns the same result after a lost reply. Create an owned preview directly through `createPreview` with the authenticated user and no site key or claim secret. Insert the Build-origin linkage before returning the site ID. Do not publish here. |
| `GET /api/build/v1/projects/{projectId}` | Return only this owner's registered project linkage, site state, current live deployment and publication revision, candidate identity/expiry, and publication eligibility. Return a constrained Drop management URL when hosting action is needed. No listing of unrelated Drop sites. |
| `GET /api/build/v1/operations/{operationId}` | Reconcile a timed-out request. Return pending, completed result, or definitive failure, bound to owner, Build client, project, and request digest. Do not infer completion from a browser success redirect. |
| `POST /api/build/v1/sites/{id}/publish` | First permanent publication of the staged immutable version, with expected site revision, stage identity, digest, and an idempotency key. Reuse `publishSite`, slot allocation, and paid checks. Return `402 hosting_required` or `409 capacity_or_revision_conflict` without changing live content. |
| `POST /api/build/v1/sites/{id}/replace` | `action:start` carries complete manifest, Build version/digest, expected publication revision, expected candidate identity or null, and operation key. Reuse upload validation, per-site lease, and missing hashes. `action:complete` checks the same operation and creates its candidate. Successful replay returns the original candidate result. |
| `PUT /api/build/v1/sites/{id}/replace?upload=...&hash=...&part=...` | Reuse verified blob parts. Bind upload to the owner, Build client, project, operation, and site. Enforce entitlement and request/byte limits. |
| `DELETE /api/build/v1/sites/{id}/replace?upload=...` | Cancel only that operation's upload. A late cancel cannot delete another operation's candidate or a completed publication. |
| `POST /api/build/v1/sites/{id}/candidate` | Publish `{candidateId, artifactDigest, expectedPublicationRevision}` with an idempotency key. Verify exact reviewed version, current owner and hosting, and atomically compare revision before switching live. |
| `DELETE /api/build/v1/sites/{id}/candidate?version=...` | Discard only that operation's reviewed candidate; stale identity returns conflict. Retain the Build saved version. |

For first publication, the ZIP path is the smallest reuse but inherits 25 MiB/100-file limits. The later project decision must either keep generated artifacts within those limits or extend first-site staging to use the manifest/blob protocol. The current paid replacement protocol cannot create an unpublished first site because `ownedPublishedSite` requires an already-live eligible publication. Do not silently impose five pages or assume all 500 MB paid sites can be created through the preview API. Extending initial staging is a separate required Drop change if larger first publications are accepted.

No new billing, domain, restore, or arbitrary import API is needed for the first release. Redirect the authenticated client to Drop for those operations. Build should reconcile site state when they return. If Build later exposes restoration, require a fresh explicit Publish-equivalent action and the same expected-revision check.

### Records and conflict rules

Build owns its project, immutable complete versions, conversation, preview grants, selected publication intent, and the link to the returned Drop site. Drop owns the authoritative inverse linkage, for example a unique `(registeredClientId, projectId)` record with `siteId`, canonical owner, and provenance. Build cannot mark a random existing Drop site as Build-origin. Create provenance only through the authenticated first-stage operation, preserve it through ordinary Drop replacement/restoration, and expose it read-only to the integration.

Drop also owns the publication-operation ledger. Bind each key to owner, client, project, action, immutable artifact digest, and preconditions. The same key and payload return the original result; reusing a key with another payload returns conflict. Allocate and persist linkage/operation identity before nontransactional R2 work so retries reconcile incomplete work rather than create another site. Record a completed operation in the same database transaction as its pointer/revision mutation, then recover its response after interruption. Hash-verified part retry alone is insufficient.

Add a monotonically increasing `publicationRevision`, incremented whenever live content or publishability changes: first publish, candidate publish, restoration, deletion/blocking, or relevant ownership/state changes. Both Drop UI routes and Build routes must participate. A Build operation carries the revision observed during review; compare it atomically with the pointer change. Candidate creation/completion must also compare candidate identity so Build cannot silently discard a candidate uploaded through Drop. Preserve the current per-site upload lease. Subscription eligibility must be checked at commit time even when a stage was paid at creation.

On any mismatch, return a structured conflict with current authorized site/candidate state and leave both live content and the saved Build version intact. Show the client that Drop changed since their review. Offer cancellation or a fresh review and explicit replacement; never silently overwrite or automatically merge. Build can continue editing its own version, but cannot claim its saved source equals the current live site after a Drop-side upload or restore. Importing unrelated Drop sites remains out of scope.

Keep enough linkage/operation tombstone information to distinguish an expired staging preview from an intentional site deletion. A retry of an already-completed create must not recreate a deleted site. An expired initial stage can be restaged only through a new explicit operation, retaining the same project provenance and a documented new staging identity. Retention periods for those records remain a decision.

## Minimum changes by application

Drop changes:

1. Add the selected identity-provider or constrained handoff contract, preserve existing user IDs, update login continuation and auth-route allowlists, and define grant/session revocation. Update the account terminology after decision.
2. Add the narrow authenticated integration routes above, backed by existing domain functions. Keep browser owner routes protected by their current session/Origin checks. Add integration-specific rate and byte limits rather than bypassing public counters.
3. Add Build provenance/linkage, operation results, and publication revision records. Extend existing Drop publication/restoration/state mutations to maintain revisions and reject stale candidate replacement where required.
4. Stage owned first-publication files and preserve explicit immutable publication intent through checkout. Extend initial upload limits/protocol only if the agreed Build artifact limits require it.
5. Keep billing, slots, domain management, serving, and retained versions authoritative in Drop. With Build-owned previews, there is no need to broaden Drop's production embedding allowlist. If candidate embedding is later wanted, add only the exact Build origin and review the candidate CSP separately.

Build changes:

1. Add the shared identity client, local server session, canonical subject mapping, and server-held publication credentials. Replace fx0's unrelated identity integration during its vinext port; compatibility is a separate research concern.
2. Persist projects and immutable completed file trees. Persist a new version only after all pages/assets validate. An interrupted tab retains the previous complete version and offers retry; it never leaves a live pointer to partial output.
3. Implement isolated private preview serving and grant lifecycle. Validate all page/resource URL forms before calling the preview complete.
4. Record frozen Publish intents and operation IDs, call the integration server-side, reconcile unknown outcomes, and display hosting and revision conflicts. Keep edits unpublished until explicit Publish.
5. Enforce generation allowance and global funded-spend controls in Build, independent of hosting. Amounts, reset policy, and model selection remain open.

## Remaining decisions and validation

Decisions for the parent tickets are the identity deployment and protocol, session/logout/disconnect behavior, artifact size and file limits, private preview browser support and external-resource policy, conflict presentation and explicit overwrite flow, initial-payment continuation, integration rate limits, and storage/operation retention. These findings do not select allowance amounts, budget amounts, or a model.

Before implementation is accepted, test:

- Existing Drop user and new signup can enter both apps as the same canonical owner; forged callbacks, replayed codes, wrong audiences, revoked grants, and synthetic user IDs fail.
- A valid service binding without a user grant cannot publish. Another owner's ID, a non-Build site, a suspended subscription, a blocked/deleted site, and exhausted capacity fail without changing the live version.
- Initial creation, final blob completion, first publication, and candidate publication recover from a lost response without duplicates. Key/payload mismatch fails. A crash between R2 and D1 remains recoverable.
- Drop restores or publishes during Build review, including A-to-B-to-A, and Build receives a conflict. Concurrent candidate completion cannot erase the other candidate without review.
- Private previews load nested pages, root-relative assets, CSS `url(...)`, JS modules, JSON fetches, fonts, and images in supported browsers with third-party cookies blocked. Expired/revoked grants, HEAD/range/304, cache hits, and direct URL access cannot bypass authentication. Generated JS cannot obtain an account credential or navigate the parent.
- Payment confirms only the frozen explicit publication intent. Expired staging files can be reconstructed from the saved Build version without another model call. Closing the generation tab keeps the last complete version.

Actual checks in this run were canonical-document reads, Drop source/schema/configuration inspection, installed Better Auth 1.7.7 implementation inspection, existing HTTP test-source inspection, primary-document retrieval, Git baseline/cleanliness checks, and report link/whitespace validation. No application tests, vinext build, browser preview, Cloudflare CLI resource operation, paid API/model call, deployment, provisioning, or production write was performed. Drop's files and the parent planning tracker were not changed. The earlier terminal-failed research run supplied no assumed findings; the supplied preliminary observations were reverified here.

Traceability: resumed from `node:delegated-task:command%3Amcp%3Ac13489ac-b638-426f-b307-884736842c15%3Adelegate-task%3Afx0-wayfinder-research-drop-20261023-r1`.

## Local source references

These links use the canonical Drop checkout rather than the isolated fx0 branch. Line references were checked against the inspected commit.

[context]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/CONTEXT.md:1
[adr1]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/docs/adr/0001-claim-cta-direct.md:1
[adr2]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/docs/adr/0002-pay-then-domain.md:1
[adr3]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/docs/adr/0003-content-addressed-deployments.md:1
[api-create]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/pages/api/v1/sites/index.ts:9
[api-update]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/pages/api/v1/sites/[id].ts:9
[agent]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/lib/agent-publish.ts:10
[mcp]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/pages/mcp.ts:29
[claim]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/pages/api/sites/[id]/claim.ts:8
[account-sites]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/lib/account-sites.ts:45
[revoke]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/pages/api/sites/[id]/revoke-key.ts:6
[limits]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/lib/limits.ts:1
[archive]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/lib/archive.ts:23
[rate]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/lib/rate-limit.ts:10
[create-preview]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/lib/create-preview.ts:66
[ownership]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/lib/ownership.ts:4
[auth]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/lib/auth.ts:22
[auth-route]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/pages/api/auth/[...all].ts:10
[middleware]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/middleware.ts:4
[billing-http]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/lib/billing-http.ts:6
[publish-route]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/pages/api/sites/[id]/publish.ts:6
[publishing]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/lib/publishing.ts:6
[billing]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/lib/billing.ts:15
[checkout]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/pages/api/billing/checkout.ts:6
[app-config]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/wrangler.jsonc:15
[sites-config]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/sites-worker/wrangler.jsonc:14
[serve-headers]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/sites-worker/src/index.ts:13
[serve-routing]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/sites-worker/src/index.ts:234
[replace-route]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/pages/api/sites/[id]/replace.ts:8
[replacements]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/lib/replacements.ts:11
[candidate-route]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/pages/api/sites/[id]/candidate.ts:6
[versions]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/lib/versions.ts:21
[restore-route]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/src/pages/api/sites/[id]/restore.ts:7
[cleanup]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/sites-worker/src/index.ts:319
[candidate-tests]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/tests/http/candidate-versions.test.ts:97
[schema]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/db/schema.sql:13
[ott]: /Users/andreichira/Downloads/projects/astro/static-hosting-mvp/node_modules/better-auth/dist/plugins/one-time-token/index.mjs:20
