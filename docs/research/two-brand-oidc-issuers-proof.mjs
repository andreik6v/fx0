// Local in-memory proof for docs/research/two-brand-oidc-issuers.md. Not Drop code; no network calls.
// Setup: npm i better-auth@1.7.7 @better-auth/oauth-provider@1.7.7 @better-auth/core@1.7.7 @better-auth/utils@0.4.2 better-call@1.4.0 @better-fetch/fetch@1.3.2 jose@6.2.12
// One shared user DB; a Better Auth instance built per request from the request host, as Drop src/lib/auth.ts does.
import assert from 'node:assert/strict';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { jwt } from 'better-auth/plugins';
import { oauthProvider } from '@better-auth/oauth-provider';
import { createLocalJWKSet, jwtVerify, decodeJwt } from 'jose';
import { createHash, randomBytes } from 'node:crypto';

const BRANDS = {
  'drop.simplenet.ro': { origin: 'https://drop.simplenet.ro', build: 'https://build.simplenet.ro' },
  'drop.kiravo.net': { origin: 'https://drop.kiravo.net', build: 'https://build.kiravo.net' },
};
const SECRET = 'x'.repeat(40);
const db = {};
let PAIR = true;
const log = (k, v) => console.log(`${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);

function createAuth(request) {
  const brand = BRANDS[new URL(request.url).hostname];
  return betterAuth({
    secret: SECRET,
    baseURL: brand.origin,
    trustedOrigins: Object.values(BRANDS).map((b) => b.origin),
    database: memoryAdapter(db),
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: false },
    advanced: { crossSubDomainCookies: { enabled: false } },
    plugins: [
      jwt(),
      oauthProvider({
        loginPage: '/login',
        consentPage: '/consent',
        // Pairing enforced by the per-request closure: only this storefront's Build callback.
        ...(PAIR ? { validateRedirectUri: (uri, registered, defaultResult) => defaultResult && new URL(uri).origin === brand.build } : {}),
      }),
    ],
  });
}
const call = (url, init = {}) => createAuth(new Request(url)).handler(new Request(url, { redirect: 'manual', ...init }));

// Seed tables the memory adapter needs.
for (const m of ['user', 'session', 'account', 'verification', 'jwks', 'oauthClient', 'oauthRefreshToken', 'oauthAccessToken', 'oauthConsent', 'oauthResource', 'oauthClientResource', 'oauthClientAssertion', 'rateLimit']) db[m] = [];

// 1. Discovery per host.
const disc = {};
for (const host of Object.keys(BRANDS)) {
  const res = await call(`https://${host}/api/auth/.well-known/openid-configuration`);
  assert.equal(res.status, 200, `discovery ${host}`);
  disc[host] = await res.json();
  log(`discovery ${host}`, { issuer: disc[host].issuer, authorization_endpoint: disc[host].authorization_endpoint, token_endpoint: disc[host].token_endpoint, jwks_uri: disc[host].jwks_uri, subject_types_supported: disc[host].subject_types_supported, id_token_alg: disc[host].id_token_signing_alg_values_supported, iss_param: disc[host].authorization_response_iss_parameter_supported });
}

// 3. One user, signed up on Simplenet; a separate host session on each storefront.
async function signIn(host, path, body) {
  const res = await call(`https://${host}/api/auth/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: `https://${host}` }, body: JSON.stringify(body) });
  assert.equal(res.status, 200, `${path} on ${host}: ${await res.clone().text()}`);
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}
const creds = { email: 'owner@example.com', password: 'correct horse battery staple' };
const cookies = {
  'drop.simplenet.ro': await signIn('drop.simplenet.ro', 'sign-up/email', { ...creds, name: 'Owner' }),
  'drop.kiravo.net': await signIn('drop.kiravo.net', 'sign-in/email', creds),
};
const userId = db.user[0].id;
log('drop user id', userId);

// 2. One client, two redirect URIs, created server-side.
const auth0 = createAuth(new Request('https://drop.simplenet.ro/'));
const client = await auth0.api.adminCreateOAuthClient({ headers: new Headers({ cookie: cookies['drop.simplenet.ro'] }), body: {
  client_name: 'Build', redirect_uris: Object.values(BRANDS).map((b) => `${b.build}/api/auth/callback`),
  token_endpoint_auth_method: 'client_secret_post', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], skip_consent: true,
} });
log('client', { client_id: client.client_id, redirect_uris: client.redirect_uris, subject_type: client.subject_type });


function pkce() { const v = randomBytes(32).toString('base64url'); return { v, c: createHash('sha256').update(v).digest('base64url') }; }
async function authorize(host, redirect, cookie) {
  const { v, c } = pkce();
  const url = new URL(disc[host].authorization_endpoint);
  url.search = new URLSearchParams({ client_id: client.client_id, redirect_uri: redirect, response_type: 'code', scope: 'openid email offline_access', state: 's1', nonce: 'n1', code_challenge: c, code_challenge_method: 'S256' });
  const res = await call(url.href, { headers: { cookie } });
  return { location: new URL(res.headers.get('location'), url), verifier: v };
}
async function token(host, code, redirect, verifier) {
  const res = await call(disc[host].token_endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: client.client_id, client_secret: client.client_secret, code, redirect_uri: redirect, code_verifier: verifier }) });
  return { status: res.status, body: await res.json() };
}
async function jwks(host) { return (await call(disc[host].jwks_uri)).json(); }

// 4. Same-brand flow on each host.
const sub = {};
for (const [host, brand] of Object.entries(BRANDS)) {
  const redirect = `${brand.build}/api/auth/callback`;
  const { location, verifier } = await authorize(host, redirect, cookies[host]);
  assert.equal(location.origin + location.pathname, redirect, `authorize ${host} -> ${location}`);
  log(`authorize ${host} response iss`, location.searchParams.get('iss'));
  const t = await token(host, location.searchParams.get('code'), redirect, verifier);
  assert.equal(t.status, 200, JSON.stringify(t.body));
  const keys = await jwks(host);
  const { payload, protectedHeader } = await jwtVerify(t.body.id_token, createLocalJWKSet(keys), { issuer: disc[host].issuer, audience: client.client_id });
  sub[host] = payload.sub;
  log(`id_token ${host}`, { iss: payload.iss, sub: payload.sub, aud: payload.aud, alg: protectedHeader.alg, kid: protectedHeader.kid });
  log(`access_token ${host} format`, t.body.access_token.split('.').length === 3 ? { jwt: decodeJwt(t.body.access_token) } : 'opaque');
  // The other issuer value must be rejected by an exact-issuer check.
  const other = Object.keys(BRANDS).find((h) => h !== host);
  await assert.rejects(jwtVerify(t.body.id_token, createLocalJWKSet(keys), { issuer: disc[other].issuer, audience: client.client_id }));
}
assert.equal(sub['drop.simplenet.ro'], userId);
assert.equal(sub['drop.kiravo.net'], userId);
log('sub equals Drop user id on both hosts', true);
const [ka, kb] = await Promise.all(Object.keys(BRANDS).map(jwks));
log('JWKS identical across hosts', JSON.stringify(ka) === JSON.stringify(kb));
log('jwks rows', db.jwks.length);

// 5. Cross-brand redirect URI rejected at the authorization host.
{
  const { location } = await authorize('drop.kiravo.net', `${BRANDS['drop.simplenet.ro'].build}/api/auth/callback`, cookies['drop.kiravo.net']);
  log('kiravo authorize with simplenet redirect ->', location.href);
  assert.notEqual(location.origin, BRANDS['drop.simplenet.ro'].build);
}
// 5b. Without the hook, the same request succeeds (exact match against either registered URI).
{
  PAIR = false;
  const { location } = await authorize('drop.kiravo.net', `${BRANDS['drop.simplenet.ro'].build}/api/auth/callback`, cookies['drop.kiravo.net']);
  log('without validateRedirectUri, kiravo authorize with simplenet redirect ->', location.origin + location.pathname + ' iss=' + location.searchParams.get('iss'));
  PAIR = true;
}

// 6. Code minted on Simplenet, redeemed at Kiravo's token endpoint.
{
  const redirect = `${BRANDS['drop.simplenet.ro'].build}/api/auth/callback`;
  const { location, verifier } = await authorize('drop.simplenet.ro', redirect, cookies['drop.simplenet.ro']);
  const t = await token('drop.kiravo.net', location.searchParams.get('code'), redirect, verifier);
  log('cross-host code redemption status', t.status);
  if (t.status === 200) log('cross-host redeemed id_token iss', decodeJwt(t.body.id_token).iss);
}

// 7. Refresh token from Simplenet used at Kiravo.
{
  const redirect = `${BRANDS['drop.simplenet.ro'].build}/api/auth/callback`;
  const { location, verifier } = await authorize('drop.simplenet.ro', redirect, cookies['drop.simplenet.ro']);
  const t = await token('drop.simplenet.ro', location.searchParams.get('code'), redirect, verifier);
  const res = await call(disc['drop.kiravo.net'].token_endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: client.client_id, client_secret: client.client_secret, refresh_token: t.body.refresh_token }) });
  const body = await res.json();
  log('cross-host refresh status', res.status);
  if (res.status === 200 && body.id_token) log('cross-host refreshed id_token iss', decodeJwt(body.id_token).iss);
}
console.log('OK');
