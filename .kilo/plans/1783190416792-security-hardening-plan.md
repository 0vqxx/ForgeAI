# Forge Security Hardening Plan

Remediation plan for vulnerabilities found in the Forge backend (FastAPI + agent
tooling). Ordered by severity. Requires an implementation-capable agent — this
plan does not modify source.

## Context / Attack surface
- `backend/server.py` — FastAPI app, CORS, `verify_secret_token` HTTP middleware.
- `backend/routes/{ai,fs,git,terminal}.py` — REST + WebSocket endpoints.
- `backend/agents/{tools,runner}.py` — agent tool execution (shell, fs, zip).
- Auth model: single shared static `FORGE_SECRET_TOKEN` sent as `x-forge-secret`.
- `x-session-id` header selects a per-session workspace directory.

## Findings summary
Critical (RCE): unauthenticated terminal WebSocket; `execute_command` shell=True
with bypassable blocklist; auto-approved agent tools (prompt-injection → RCE).
High (escape): raw `x-session-id` in fs paths; symlink escape via `abspath`;
prefix checks lacking separators; zip-bomb in `unzip_archive`.
Medium: arbitrary provider/model selection (incl. jailbroken aliases); verbose
error disclosure; static shared secret; CORS wildcard + credentials.
Plus DDoS/resource items from prior review (no rate limiting, unbounded PTY
forks, unbounded max_tokens, in-memory uploads, uncapped search/git subprocess).

## Tasks (priority order)

### 1. Close unauthenticated terminal WebSocket (Critical)
- In `backend/routes/terminal.py`, before `pty.fork()`, validate a token from
  `ws.headers.get("x-forge-secret")` (or a query param, since browsers can't set
  WS headers — decide which; recommend a short-lived signed token via query).
  Reject with `await ws.close(code=1008)` on mismatch/missing.
- Add a module-level `asyncio.Semaphore` capping concurrent terminals (e.g. 3–5);
  reject when exhausted.
- Add an idle timeout that closes the WS and reaps the child if no I/O for N min.
- Open question: is the terminal feature meant to be exposed at all in the hosted
  deployment? If not, gate it behind a config flag defaulting to off.

### 2. Sanitize `x-session-id` before filesystem use (High)
- In `backend/agents/tools.py::get_session_workspace`, reject or slugify
  `session_id`: allow only `[A-Za-z0-9_-]`, reject `..`/path separators.
- Apply the same validation wherever `session_id` builds paths
  (`create_zip_archive` downloads dir, `routes/fs.py::get_session_id`).
- Add a test: `x-session-id: ../../etc` must be rejected, not escape the root.

### 3. Harden agent path resolution against symlink/prefix escape (High)
- Replace `os.path.abspath` with `os.path.realpath` in `tools.py::_resolve_path`
  so symlinks are resolved before the jail check.
- Replace `startswith(workspace)` prefix checks with `Path.relative_to` (raises on
  escape) or ensure comparison uses a trailing `os.sep`. Fix the same pattern in:
  - `tools.py:32` (`_resolve_path`)
  - `tools.py:280` (zip-slip guard in `unzip_archive`)
  - `fs.py:43` (backend-dir check)
- Verify `.env` / backend guards still hold after symlink resolution.

### 4. Restore human-in-the-loop / restrict command execution (Critical)
- In `backend/agents/runner.py:255-260`, stop hardcoding `approved = True`. Either:
  - (a) Wire `execute_command` (and `write_workspace_file`) through the existing
    `confirmation_manager` and block until approved/denied, or
  - (b) If unattended execution is required, replace `shell=True` with an argv
    list + strict command allowlist (e.g. `npm`, `pnpm`, `pytest`, `node`, `git`)
    and drop the substring blocklist entirely.
- Recommend (b) for a hosted agent: allowlist executables, no shell, run with a
  reduced-privilege user and resource limits (CPU/mem/time). Keep the 30s timeout.
- Decision needed: interactive approval vs. allowlist-only. Recommend allowlist.

### 5. Add zip/decompression limits (High)
- In `unzip_archive`, enforce a max total uncompressed size and max file count
  before/while extracting; reject archives exceeding the cap (zip-bomb guard).
- Keep the (fixed) zip-slip check from task 3.

### 6. Validate provider/model against an allowlist (Medium)
- In `backend/routes/ai.py`, reject `provider`/`model` values not in a server-side
  allowlist. Remove or gate `*-jailbroken` aliases behind explicit config.

### 7. Stop leaking internal error detail (Medium)
- Return generic messages to clients; log full exceptions server-side.
  - `ai.py:143` (`AI API error: {str(e)}`) → generic 500 + server log.
  - `git.py:54` and the `verify_secret_token` 500 body → generic text.

### 8. Fix CORS (Medium)
- In `server.py`, replace `allow_origins="*"` + `allow_credentials=True` with an
  explicit origin allowlist from config; scope `allow_methods`/`allow_headers`.

### 9. Rate limiting + resource caps (DDoS, from prior review)
- Add `slowapi` per-IP limits; stricter on `/api/ai/*` and `/api/fs/search`.
- Clamp `max_tokens` to a ceiling; cap agent-loop iterations (already 5) and add a
  total stream wall-clock timeout.
- Stream uploads with a max size (`fs.py:110`) instead of `await file.read()`.
- Add wall-clock/file-count budget to `/api/fs/search` (`fs.py:203`).
- Global semaphore + `asyncio.wait_for` timeout + output truncation for `git.py`
  subprocesses.
- Run uvicorn behind a reverse proxy with connection/body-size limits; set
  `--limit-concurrency` and keep-alive timeout; add a disk quota for
  `public/downloads`.

## Validation
- Add regression tests:
  - WS connection without valid token is rejected before fork.
  - `x-session-id: ../../etc` cannot create/access paths outside the workspace.
  - Symlink inside workspace pointing to `/etc/passwd` cannot be read.
  - Zip-slip and zip-bomb archives are rejected by `unzip_archive`.
  - `execute_command` allowlist blocks non-allowlisted binaries; shell metachars
    are not interpreted (if argv approach chosen).
  - Unknown/jailbroken `provider`/`model` returns 400.
- Manual: confirm CORS behavior with a disallowed origin; confirm rate limits
  return 429 under a flood; confirm error responses no longer include tracebacks.

## Notes / non-issues
- Tracked `vercel_env.json` contains only a public Supabase URL (not a secret).
- `.env`, `github_token`, and `*.local` are gitignored (verify none are tracked
  with `git ls-files` before any history rewrite — and per repo policy, do NOT
  force-push/rewrite published history).

## Open decisions (resolve during implementation)
1. Terminal WS: keep-and-authenticate vs. disable in hosted mode? (rec: gate off).
2. Command execution: interactive confirmation vs. argv allowlist? (rec: allowlist).
3. WS token transport: query param signed token vs. header (rec: signed query token).
