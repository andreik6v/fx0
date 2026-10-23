# DeepSeek Flash feasibility for Build

Research date: 2026-10-24. Evidence for the claimed local ticket "Assess DeepSeek V4.1 Flash for bounded static-site generation". Documentation research only; no inference or paid evaluation ran.

## Recommendation and decision boundary

DeepSeek Flash is the better next candidate to evaluate for Build's low-cost static-site generator. Its published token rates justify reopening the earlier GPT-5.4 Mini recommendation. Its release date alone does not establish better HTML/CSS/JS output, fewer repairs, lower latency, or reliable service. None of those properties was measured here.

If the candidate passes the small evaluation below and the user selects it, start with provider-direct **Responses**, one configured model, and a request-owned loop while the generation tab stays open. Use an explicit reasoning setting and output cap. Keep provider-specific parsing and accounting in a small transport module. There is no need for model routing, a model picker, a second production model, or a general agent platform.

The user's question does not approve a model, allowance, spending cap, reset policy, or paid test. Ticket 06 remains a human decision. The old five-request allowance, USD 0.35 request ceiling, and USD 20 launch budget remain unaccepted proposals. This report supplies evidence for revising that proposal, without adopting replacement amounts.

The accepted product contract remains ordinary multi-page HTML with separate shared CSS and JavaScript, uploaded images, at most 100 files and 25 MiB per complete site version, D1/R2 persistence, the latest 20 complete versions plus the last Build-published version, and public unlisted one-hour previews. Only the client's explicit Publish sends a selected version to separate Drop. Scraping, image generation, form processing, customer builds, generated backends, and Workers for Platforms remain outside release one. These constraints come from the canonical tracker and glossary read from the parent checkout, not provider documentation.

## Model identity and reproducibility

DeepSeek currently tells callers to use `deepseek-flash`, which its pricing page maps to **DeepSeek-V4.1-Flash-1017**. The accepted legacy identifiers `deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` now serve that same replacement model. Thus an old-looking identifier does not pin old behavior. The advertised context is 1M tokens and maximum output is 384K; those provider maxima are far above the proposed application bounds. [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing/)

The October 17 announcement claims better coding benchmark performance, shorter outputs, and faster completion than its predecessor. Its DeepSWE chart uses mini-swe-v2. Those vendor results do not test Build's static site briefs, design quality, cross-file preservation, or comparison against GPT-5.4 Mini under Build's bounds. They support trying the candidate, rather than declaring a winner. [October release](https://api-docs.deepseek.com/news/news261017/)

I found **no documented hosted snapshot identifier or immutability promise** for the October Flash release in the current pricing, endpoint schemas, or model-discovery documentation. The documented request model names are aliases. `/models` describes discoverable IDs and capability metadata; its example does not establish an immutable snapshot. This is a documentation finding, not a failed authenticated snapshot request. [Responses reference](https://api-docs.deepseek.com/api/create-response/), [model discovery](https://api-docs.deepseek.com/api/list-models/)

By comparison, official OpenAI documentation lists `gpt-5.4-mini-2026-03-17` as a snapshot alongside its alias. It also lists streaming, function calling and Responses support. This is a reproducibility advantage, not a measured quality advantage. [GPT-5.4 Mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini)

The dated open-weight Flash repository is separately versionable. Pinning those files does not pin DeepSeek's hosted alias, and self-hosting is outside this recommendation. Record the requested alias, returned model and any fingerprint, protocol, reasoning setting, prompt/tool schema revision, and rate schedule with an evaluation. Recheck a small fixture after a documented alias update; do not silently substitute a production provider.

## Responses versus Chat Completions

The following are documented Responses compatibility limits, not runtime test results. [DeepSeek Responses guide](https://api-docs.deepseek.com/guides/responses_api/)

| Area | Documented behavior |
| --- | --- |
| Streaming | Semantic SSE ends with `response.completed`, `response.incomplete`, or `response.failed`; no `[DONE]`. |
| Tool bounds | `max_tool_calls` ignored; `parallel_tool_calls` ignored, always enabled. |
| Roles | `developer` becomes `user`; `instructions` becomes the first system message. |
| State | No `previous_response_id`, `conversation`, stored responses, or background mode. |
| Overflow | No automatic `truncation`; context overflow returns 400. |
| Reasoning replay | Plain-text reasoning items supported; encrypted reasoning and summaries unsupported. |
| Other controls | Unsupported parameters can be silently ignored; `stream_options` unsupported. |
| Extra tools | Ordinary functions supported; custom tool name limited to `apply_patch`; most built-ins ignored. |

The Responses reference explicitly defines `max_output_tokens` as covering visible **and reasoning** tokens. `usage.output_tokens_details.reasoning_tokens` is a breakdown of `output_tokens`, not an extra quantity to add twice. It also documents `text.format` with JSON object and JSON schema formats, and ordinary function arguments that still require local validation. [Responses reference](https://api-docs.deepseek.com/api/create-response/)

Chat Completions has useful tradeoffs. It uses `messages`, nested function definitions, `max_tokens`, and data-only SSE ending in `[DONE]`. Its final content chunk carries usage and a non-null finish reason; there is no separate usage-only chunk. Documented omitted-output defaults are 8K without thinking, 64K with thinking, and 128K at maximum effort. Its `required` and named tool choices reject thinking mode with 400. [Chat reference](https://api-docs.deepseek.com/api/create-chat-completion/)

DeepSeek's tool guide also says Chat cannot accept artificially inserted tool calls mid-history, while Responses can. The guide describes strict function schemas as beta, requiring the `/beta` base URL, with unsupported string-length and array-length constraints. Ordinary tools execute in the calling application. [Tool guide](https://api-docs.deepseek.com/guides/tool_calls/)

I recommend Responses for the first compatibility test because its combined output cap is explicit and its terminal statuses distinguish a truncated response from completion. Its item format and documented structured text options fit complete file-change batches. Chat remains a reasonable alternative if a short protocol test shows it materially simplifies the chosen transport. Its smaller-looking API does not remove local tool bounds, replay accounting, or completion validation. Do not implement both paths speculatively.

For either path, send Build's trusted rules as system instructions. Treat user prompts and project files as untrusted content. Register only the small file tools needed for static editing; never expose Publish, deployment, a shell, scraping, or paid built-in tools to the model. Validate complete function arguments before execution. Apply a returned batch serially to a private working set after checking all paths and duplicate writes. Reject a whole conflicting or over-limit batch. A model emitting several calls does not authorize executing them concurrently or exceeding the application's tool limit.

These findings do not establish SDK, libfx, or Worker end-to-end compatibility. No transport/parser was changed or run against DeepSeek.

## Thinking, history, and the bounded loop

Thinking defaults to **enabled, high effort**. Responses uses `reasoning.effort`, with `none` disabling thinking and `low`, `high`, and `max` enabling it. Chat also exposes `thinking.type` and `reasoning_effort`. Effort aliases are remapped, for example medium and xhigh become high. In thinking mode temperature has no effect. Flash's top-p behavior differs by mode. Most importantly, requests carrying tools must replay prior `reasoning_content`, including turns without tool calls; omission can produce 400. Without tools, prior-turn reasoning is ignored. [Thinking guide](https://api-docs.deepseek.com/guides/thinking_mode/)

Use explicit `reasoning.effort: "low"` as an initial evaluation setting, subject to user approval of the future test. Low effort is a test hypothesis, not a separate guaranteed reasoning-token cap. Always set `max_output_tokens`; never rely on omitted defaults. A 12,000-token cap is shared by reasoning, file contents, and other generated output. A request can spend its output budget without producing a complete useful site. Compare disabling thinking only if the first small test shows reasoning is consuming that budget without useful output.

Both protocols require caller-owned history. Chat explicitly requires concatenating history on each request; Responses likewise documents sending history in `input`. [Multi-round guide](https://api-docs.deepseek.com/guides/multi_round_chat/), [Responses reference](https://api-docs.deepseek.com/api/create-response/)

Recommended changes to the proposed loop:

1. Construct a bounded context from the latest complete site version, current brief, selected conversation context, asset manifest, and tool schemas. Do not send every saved version. A 25 MiB storage allowance is not a promise that all project bytes fit a model request.
2. Before **each physical model send**, count or conservatively bound all input again, including returned file contents, tool results, and replayed reasoning. Reserve that send's input and maximum combined output at peak rates. Tool execution itself does not include the cost of the next model send.
3. Keep original response items and call IDs through the current tool cycle. Do not reconstruct continuation from `output_text` alone. Keep protocol reasoning separate from generated files and the client-facing explanation. Bound all retained history and tool-result bytes.
4. Enforce paid-send count, total tool-call count, batch size, wall-clock deadline, cumulative liability, and file limits in Build. Ignored provider controls cannot enforce these limits. On any exceeded bound, stop; do not add an unreserved cleanup or repair send.
5. Treat partial streamed file contents as provisional. Only normal generation completion, with no pending tool calls and a valid complete working set, may create a completed D1/R2 site version. Preserve all unchanged files and uploaded assets when an edit changes a subset. Failure, truncation or cancellation leaves the last completed version available and offers explicit Retry. Publication remains a separate client action.

## Conservative input admission and tokenizers

DeepSeek's token guide gives rough character ratios but explicitly says tokenization varies and returned usage is authoritative. It offers an offline tokenizer ZIP. Those ratios are cost estimates, unsuitable as hard admission limits for code, Unicode, or tool history. I found no documented DeepSeek preflight token-count endpoint in the current API navigation and references inspected. [Token guide](https://api-docs.deepseek.com/quick_start/token_usage/)

The linked [tokenizer archive](https://cdn.deepseek.com/api-docs/deepseek_v4_tokenizer.zip) was downloaded and inspected without running its Python. SHA-256 was `e7310d1dafe0a86d8a5629fe78a7c763760f651db9b8682718a1781dcd6fe495`. Its config says `model_max_length: 16384` and includes an older chat template. That value is not the hosted model's current context limit, and this generic archive does not establish exact V4.1 hosted request accounting.

A better investigation starting point is the version-specific [V4.1 encoding reference](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017/blob/1bae0e1088993b9b82de08f59de5be5a34e42170/encoding/README.md) and [tokenizer config](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017/blob/1bae0e1088993b9b82de08f59de5be5a34e42170/tokenizer_config.json). The reference documents tool-schema insertion and changed V4.1 prompt formatting; its numeric effort settings are encoding details, not an expanded hosted API contract. The config gives 1,048,576 context tokens. The [tokenizer JSON](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017/blob/1bae0e1088993b9b82de08f59de5be5a34e42170/tokenizer.json) inspected at that revision has byte-level BPE and an empty normalization sequence. Its SHA-256 was `c90dfa01249db1be4245780a052ede752e1361c612ac6d08e2bdada7d599476b`.

For implementation, choose one of these admission approaches and prove its properties before claiming the example ceiling below:

- Use a pinned V4.1 tokenizer **and the complete prompt serialization**, including instructions, tool descriptions/schema conversion, messages, reasoning, results, and protocol markers. A Python reference is evidence, not a demonstrated Worker-compatible tokenizer. A JS/WASM port or a separately run tokenizer requires size/runtime checks and comparison with hosted usage.
- For a simpler first implementation, restrict text, number of messages, tool schemas, and result sizes, then derive a conservative UTF-8-byte bound plus audited template overhead. Byte-level BPE supports investigating a one-token-per-byte text bound; raw HTTP JSON length or an arbitrary safety percentage alone does not prove the hosted prompt bound. Server-added formatting still needs an envelope.
- Until that envelope is established, refuse inputs that cannot be bounded or reserve the full documented context as an intentionally loose input upper bound. This loses much of the small-request budget benefit. Do not advertise a strict 32,000-token admission ceiling based on character ratios or a guessed tokenizer match.

An illustrative fallback reservation using 1,048,576 input tokens and 12,000 output tokens costs USD 0.3289728 per send at today's Flash peak rates, or USD 1.3158912 for four sends. This deliberately over-reserves because the context includes output too. It demonstrates why proving a tighter admission bound matters; it does not propose an allowance.

Uploaded images can stay in R2 and be referenced by their paths, dimensions and client-supplied descriptions, without sending image pixels to inference. Optional image analysis would need separate admission accounting. DeepSeek documents an image upper bound of 1,024 tokens per image, plus request size/dimension limits. Project upload limits do not substitute for those API limits. The scenarios below include text input only. [Vision guide](https://api-docs.deepseek.com/guides/vision/)

## Retry behavior and funding controls

DeepSeek documents 429 for rate/concurrency limits, and recommends waiting before retrying 500/503. It distinguishes malformed requests, authentication failures, insufficient balance, and invalid parameters. None of these instructions establishes idempotent generation or an exactly-once billing guarantee after a timeout. [Error codes](https://api-docs.deepseek.com/quick_start/error_codes/)

The service documents streaming keep-alive comments and a connection close after ten minutes if inference has not started. Account concurrency is shared across keys; the published Flash limit is 2,500. These are provider limits, not appropriate public trial allowances or latency guarantees. [Rate limits](https://api-docs.deepseek.com/quick_start/rate_limit/)

Use an explicit transport with no hidden automatic resend. If an SDK, proxy, or existing libfx transport is retained, inspect and disable its retries or route every physical resend through the same reservation code. No SDK retry behavior was validated in this worktree. Do not assume changing `base_url` preserves accounting behavior.

At AI-request admission, atomically reserve the client's chosen allowance unit and the request's maximum monetary liability against platform funding in D1. Allocate each physical send from that durable request reservation; do not double-count the parent and its child allocations. Use a stable application command ID to deduplicate repeated client submissions. Track physical dispatches separately: application deduplication does not deduplicate provider billing. A fresh paid resend needs a full send allocation and counts against the paid-send bound. Internal tool continuations need not consume extra client request units if ticket 06 chooses a request-based allowance. Recommended release-one behavior is explicit client Retry after failure, without automatic provider failover or background recovery. The allowance treatment of that Retry still belongs to ticket 06.

If terminal usage is present, settle the complete input/output totals at the applicable recorded rates and release the unused reservation. Retain peak valuation if the applicable tariff cannot be established, including a request crossing a tariff boundary. Do not add reasoning tokens twice or assume all input was cached. If cancellation, lost SSE, timeout or a crash leaves charges unknown, retain the maximum liability hold; do not treat aborting HTTP as proof of no charge. Resolve an unknown charge through later authoritative billing evidence or a deliberate operator procedure. Never release it merely because a lease expired. Reserve each concurrent request before dispatch, so client and global limits cannot be oversubscribed.

Cache hits are automatic, prefix-dependent, and best effort. They can reduce settled cost, but are not admission funding. [Cache guide](https://api-docs.deepseek.com/guides/kv_cache/)

## Reproducible equal-token costs

Standard USD token rates per million, verified on the research date:

| Model and tariff | Uncached input | Cached input | Output |
| --- | ---: | ---: | ---: |
| DeepSeek Flash, peak | 0.30 | 0.006 | 1.20 |
| DeepSeek Flash, off-peak | 0.15 | 0.003 | 0.60 |
| GPT-5.4 Mini, standard | 0.75 | 0.075 | 4.50 |

DeepSeek defines peak as 01:00–04:00 and 06:00–10:00 UTC Monday through Friday, excluding Chinese public holidays. Other times are off-peak. It reserves the right to change prices. Reserve against peak and cache misses regardless of dispatch time. [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing/), [official OpenAI model pricing](https://developers.openai.com/api/docs/models/gpt-5.4-mini)

For uncached input `I` and **all billed output** `O`, including reasoning, the calculations are:

```text
Flash peak USD     = (0.30 * I + 1.20 * O) / 1_000_000
Flash off-peak USD = (0.15 * I + 0.60 * O) / 1_000_000
GPT-5.4 Mini USD   = (0.75 * I + 4.50 * O) / 1_000_000
```

| Hypothetical workload | Total input | Total output | Flash peak | Flash off-peak | GPT-5.4 Mini |
| --- | ---: | ---: | ---: | ---: | ---: |
| Initial generation example | 12,000 | 8,000 | $0.0132 | $0.0066 | $0.0450 |
| Cross-file edit example | 20,000 | 4,000 | $0.0108 | $0.0054 | $0.0330 |
| One send at example caps | 32,000 | 12,000 | $0.0240 | $0.0120 | $0.0780 |
| Four sends, each at those caps | 128,000 | 48,000 | $0.0960 | $0.0480 | $0.3120 |

These are arithmetic scenarios, not observed sites or chosen quotas. Initial/edit rows can represent aggregate billed tokens over several sends. Four sends means four physical billable attempts in total, including any retry or repair. The USD 0.096 example requires a proven per-send input bound, an enforced combined output cap, and no fifth send. Replayed history must already be included in each send's 32,000 input.

At equal token counts the first two examples are about 70.7% and 67.3% cheaper at Flash peak rates. Actual cost per accepted site can differ because tokenizers encode the same files differently, reasoning and verbosity change output totals, edits replay different context, and invalid output costs repair sends. One provider taking fewer attempts can reverse a nominal token-price ranking. The table excludes taxes, infrastructure, paid tools, optional image inference and special processing tariffs. Rates must be rechecked before any budget is accepted.

## Small future evaluation, requiring separate spending approval

Use two fixed fixtures, each with one initial generation and one cross-file edit. Run the same fixtures against Flash and the pinned GPT-5.4 Mini comparator only as evaluation configurations, never as a customer model selector. This is eight user-level test attempts before any repeats. Set the maximum paid sends, combined output tokens, conservative input reservations, and overall evaluation budget before running anything.

The first fixture should be a three-page small business site with shared CSS/JS, ordinary contact links, and uploaded image paths. Its edit changes the shared navigation and color rules across all pages and adds one working JS interaction. The second should use a nested page path and non-English text; its edit renames a page, updates inbound links and an associated JS selector, while preserving unrelated copy and assets. These are test sizes, not new product limits.

Count an initial generation as successful only if it yields a complete locally valid site within the fixed paid-send bound, with separate CSS/JS, working relative links and image paths, and no package build or backend. For the edit, inspect both requested changes and preservation of untouched files. Render at mobile and desktop sizes, exercise navigation and the JS behavior, check missing assets and browser console errors, and record manual design judgments against a brief agreed before the run.

Record per physical send: model identity, protocol and settings, admission estimate, authoritative input/cache/output/reasoning usage, terminal status, wall time, tool calls, validation failures and repairs. Compare cost **per accepted fixture**, unsuccessful attempt cost, and time to usable result. No model should pass through unbounded retries.

Before release, separately verify the chosen protocol under a cut stream, output-cap truncation, multiple calls in one response, malformed arguments, oversized history, provider errors, duplicate commands, cancellation and unknown usage. Inject local failures rather than spending inference merely to trigger every error. Confirm D1 reservation races and that no incomplete R2 working set becomes a complete version or publication. A small quality sample and a protocol test are both necessary; neither establishes long-term uptime.

## Actual checks and remaining unknowns

Completed checks:

- Read the parent canonical map, ticket 10, ticket 06, and glossary via their absolute paths. Read the research, OpenAI Docs and unslop skills and this checkout's AGENTS.md.
- Searched and opened official OpenAI documentation for the exact GPT-5.4 Mini comparator. Opened current first-party DeepSeek pricing, release, protocol references, thinking/tool/history guides, token usage, caching, rate limits and errors.
- Inspected the official tokenizer archive and version-specific repository metadata, encoding documentation, tokenizer config and tokenizer JSON without executing downloaded code or loading model weights. Verified the revision and hashes reported above. No tokenizer-to-hosted-usage parity test ran.
- Recalculated the cost examples with decimal arithmetic. Checked report links and whitespace, reviewed the staged diff, and verified the report-only commit and pushed evidence branch.

Still unknown: hosted account access and availability, a supported immutable hosted Flash snapshot, exact hosted prompt serialization and tokenizer parity, Worker transport compatibility, billed behavior after lost connections, measured generation/edit quality, repair frequency, latency, and long-term service reliability. No paid model call, API credential access, deployment, application change, parent tracker edit, Drop write, PR or merge was performed. This evidence branch is for reference and must never be merged as implementation.
