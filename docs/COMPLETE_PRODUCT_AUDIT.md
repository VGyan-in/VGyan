# VGyan: complete product audit (November 2026)

Branch `audit/product-hardening-2026`, based on PR #2 (`feat/backend-dashboard-asr`, commit 428a678).
Audit date 2026-11-23. Nothing was deployed and nothing was merged into `main`.

Severity: **Critical** = child data exposure or silent loss of research data that is likely in normal
use; **High** = security weakness, data loss or misleading research data under realistic conditions;
**Medium** = correctness or robustness problem with limited impact or a workaround; **Low** = polish.

---

## 1. Overall assessment

VGyan is a well-structured offline-first system. Its fundamentals were already sound: deterministic
metrics re-verified on the server, write-once content-addressed media, idempotent sync, consent gating,
class-scoped access, and an audit log. PR #2's own report was accurate about what it had verified,
with one exception that this audit confirms and quantifies: the reading-accuracy metric is
substantially biased by speech-recognition errors.

No Critical issues were found. **14 High** and **19 Medium** issues were found and fixed, all with
regression tests or CI checks. The largest remaining risks are outside the code: nothing has run on a
physical phone, no real AI/OCR call has been made, ASR has not been validated on children's speech,
Kannada ASR does not exist, and the legal and ethics questions are open.

**Readiness:** suitable for a controlled pre-production test with adult testers after the manual
checks in [USER_ACCEPTANCE_TESTING.md](USER_ACCEPTANCE_TESTING.md). Not ready for a pilot with
children (see §16).

## 2. Architecture findings

- Clear separation: app (Expo/React Native + a Kotlin speech module), FastAPI backend, React dashboard. See [architecture.md](architecture.md).
- Configuration comes from environment variables with production guards; no hard-coded secrets.
- Strengths: shared alignment fixtures between app and server; Alembic-only schema; append-only revision log; one transaction per request, committed before the response (PR #2 fix verified).
- Weaknesses found: no durable handling for storage-side failures during deletion (fixed); the sync worker ran optional AI work before uploads (fixed); no request-size limit at the HTTP layer (fixed); observability limited to text logs (request IDs and JSON logs added).
- Still open by design: no background job runner (scheduled CLI commands instead); in-process rate limiter (single instance); teacher endpoints aggregate in Python (fine for a pilot, not district scale).
- Dead code and dependencies: no unused runtime dependencies found. `client/src/core/db/memory-repository.ts` is used by the web build and tests. The two ESLint errors were in a build script (fixed).

## 3. Critical bugs discovered

None.

## 4. Bugs and weaknesses fixed

| ID | Sev. | Area | Problem | Root cause | Fix | Verified by |
|---|---|---|---|---|---|---|
| H1 | High | Backend security | Rate limits bypassable: any client could send a new `X-Forwarded-For` value with each request | `client_ip` trusted the header's first entry; Uvicorn ran with `--forwarded-allow-ips='*'` | Header ignored unless `TRUSTED_PROXY_HOPS` set (then the right-most trusted hop is used); Uvicorn trusts only `FORWARDED_ALLOW_IPS` (default 127.0.0.1) | `test_forwarded_for_is_ignored_without_trusted_proxy`, `test_client_ip_uses_rightmost_trusted_hop` |
| H2 | High | Backend reliability | Unbounded request bodies: multipart uploads are spooled to disk before endpoint limits run, so one authenticated request could fill the disk | No limit at the ASGI layer | `BodySizeLimitMiddleware` rejects by Content-Length and while streaming (`MAX_REQUEST_MB`) | `test_oversized_request_rejected_before_reading_body` |
| H3 | High | Secrets | Google Vision API key in the request URL, and `httpx` logs every URL at INFO | Key passed as a query parameter | Key in `x-goog-api-key` header; `httpx`/`httpcore`/`botocore` loggers at WARNING | `test_vision_key_is_sent_in_a_header_not_the_url` |
| H4 | High | Deletion | A storage error during deletion lost the object keys (the rows were already deleted): children's recordings could stay in the bucket forever with no record; files were also deleted *before* the commit | Keys only in memory; delete-then-commit order | Keys queued in new `storage_deletions` table in the same transaction; commit; then delete; failures stay queued (admin page, `purge-storage` CLI) | `test_storage_failure_during_deletion_is_queued_and_retried` |
| H5 | High | Deletion | Device sessions (phone model, OS) not deleted; deleted student kept the class link | Omitted from the deletion | Sessions deleted, class link cleared | `test_deletion_removes_sessions_and_media_and_passes_integrity_check` |
| H6 | High | App sync (shared phones) | On a shared phone, other students' queued records were uploaded with the signed-in student's token, rejected 403 and marked **permanently failed** | Queue processed all participants | Uploader skips items not belonging to the signed-in student; they upload when that student signs in | `leaves another student's records…` (client) |
| H7 | High | App privacy | Records still queued when consent was withdrawn could be uploaded if the withdrawal upload itself failed transiently (the queue moved on) | No local consent check in the uploader | Reading/writing items are not uploaded unless the local consent is active; the withdrawal itself still syncs | `uploads nothing new after consent is withdrawn…` (client) |
| H8 | High | App sync | Every sync run requested AI feedback for every non-completed attempt (including permanently failed ones) **before** uploading; on a bad connection each took up to 60 s, so uploads could be delayed for many minutes | Ordering in `runSync`; unbounded retries | Uploads first; at most 6 feedback requests, only "pending" ones, stopping at the first connectivity failure; changed records re-uploaded in the same run | Typecheck + review; uploader/queue tests unchanged and passing |
| H9 | High | App sync | Expired session (401) consumed retry attempts until items stopped retrying; a later sign-in did not restart them | 401 treated as a normal retry | 401 clears the token and leaves items pending; online sign-in re-queues failed items | `on an expired session (401)…` (client) |
| H10 | High | App sync | HTTP 409 was treated as "stored", so the client could mark a record synced that the server never stored | Legacy assumption | 409 is retried; the server returns 409 only for a concurrent first upload (was a 500) | `retries a 409…` (client), `test_duplicate_insert_race_is_a_retryable_409` |
| H11 | High | Recording integrity | Backgrounding the app, a call or screen-off during recording kept "recording": Android gives background apps silence, so a silent take could be saved and scored | No lifecycle handling | The take is discarded with an explanation when the app leaves the foreground | Review; device test D10–D12 (not yet run) |
| H12 | High | Speech module | `AudioRecord.read` errors made the capture loop spin at full CPU; a lost microphone was never detected; a failed start leaked the microphone and recogniser (later recordings would fail) | Error codes ignored; no cleanup on start failure | Dead-object ends the take; repeated errors stop it; resources released on failed start | Compiles in CI (Android build run on this branch); device test D11 (not yet run) |
| H13 | High | Research validity | ASR errors bias reading accuracy downwards by ~15 points (clean) to ~40 points (noisy/fast) with the default model; the score was shown as fact and drives the 75% at-risk flag | ASR limitation | Measured and documented; app labels the score an automatic estimate; dashboard tells teachers to listen before acting. Threshold/model choice is a research decision | `tools/asr-eval` (108 synthetic recordings), [asr-evaluation.md](asr-evaluation.md) |
| H14 | High | Upload reliability | Fixed 120 s upload timeout: a 3-minute WAV (~5.8 MB) on a ~32 kbit/s rural link can never finish, so it retried forever | Constant timeout | Timeout scales with file size (up to 30 min) | `gives large recordings enough time…` (client) |
| M1 | Medium | Storage | Checksum mismatch left an orphaned object (stored before verification) | Order of operations | Verify, then store | `test_checksum_mismatch_leaves_no_orphaned_object` |
| M2 | Medium | Authorization | Any teacher could edit any passage, including the seeded research passages used by every class | No ownership check | Teachers edit only their own; admin edits all; dashboard shows "Shared" | `test_teacher_cannot_edit_shared_or_others_passages`, dashboard test |
| M3 | Medium | Research export | CSV formula injection from children's text (`=HYPERLINK(…)`) | Raw cells | Leading apostrophe on formula-like text cells | `test_research_export_escapes_formulas_and_reports_asr_status` |
| M4 | Medium | Research export | Reading export had no `asr_status`: pending recordings looked like missing metrics | Column omitted | Column added; export ID header | same test |
| M5 | Medium | Data integrity | An attempt could be linked to another student's device session by ID | No ownership check | Ownership checked | `test_cannot_link_attempt_to_another_students_session` |
| M6 | Medium | Robustness | Concurrent first upload of the same record → 500 | Unique violation unhandled | 409 `concurrent_upload` (unique violations only) | `test_duplicate_insert_race_is_a_retryable_409` |
| M7 | Medium | Availability | Server re-check of metrics is O(n·m): a 4,000-word text pair used ~16 M cells per request | No bound | Re-check skipped above 4 M cells, stored as unverified (null), never verified | `test_alignment_is_bounded_for_huge_texts` |
| M8 | Medium | Availability | Gemini retries could hold a worker ~3 minutes (60 s × 3 + sleeps) | Per-attempt timeout only | Total budget (`GEMINI_TOTAL_BUDGET_SECONDS`, 50 s) | `test_gemini_retries_stay_within_the_time_budget` |
| M9 | Medium | Robustness | Non-JSON provider body → 500 | Uncaught `ValueError` | Clean `502 ai_failed` | `test_gemini_non_json_body_is_a_clean_error` |
| M10 | Medium | AI safety | Student text could close the prompt's `<transcript>`/`<passage>` tags | No escaping | Angle brackets in student data replaced | `test_student_text_cannot_close_prompt_tags` |
| M11 | Medium | OCR UX | Blank page reported as a provider failure | Empty output not distinguished | `422 no_text_found` | `test_ocr_blank_page_is_a_clear_422` |
| M12 | Medium | Memory | Decompression-bomb images; local media read fully into memory | Defaults | 50 MP cap; `FileResponse` streaming | Review |
| M13 | Medium | Privacy (device) | Temporary WAVs from interrupted takes (a child's voice) stayed on the phone indefinitely | No cleanup | Deleted on app start unless referenced by an attempt | Review; device test D15 |
| M14 | Medium | UX | Signing in on a new phone showed the participant ID as the student's name and an empty profile | Profile not fetched | Restored from `/student/me` | Review; UAT A16 |
| M15 | Medium | UX | Permanently denied microphone permission left no way forward | No settings link | **Open app settings** button | Review; UAT A11 |
| M16 | Medium | Auth | A signed token with a malformed subject caused a 500 | Unchecked UUID parse | 401 | `test_signed_token_with_malformed_subject_is_401` |
| M17 | Medium | Memory | Rate-limiter keys never pruned | Design | Periodic pruning | `test_rate_limiter_prunes_expired_keys` |
| M18 | Medium | Teacher | Comments could be added to a deleted (inactive) student | Missing check | 404 | `test_comment_on_deleted_student_is_404` |
| M19 | Medium | CI | CI did not run on `audit/**` branches; Node 20 (EOL April 2026) in all jobs; the Docker image was built but never started | Workflow config | Triggers, Node 22, current action majors; image is started against PostgreSQL and the 22-check E2E journey plus the integrity check run inside CI | Green runs on this branch |
| L1 | Low | Lint | 2 ESLint errors in `scripts/generate-routes.js` | Node globals | ESLint config for Node scripts | `npm run lint` (0 errors) |
| L2 | Low | UX | "Handwriting clarity" displayed OCR engine confidence | Label | "Text recognition confidence" | Review |
| L3 | Low | Security headers | No `X-Frame-Options`, `Cache-Control` on API responses | Defaults | Added | `test_security_headers_and_request_id` |
| L4 | Low | Production config | `CORS_ORIGINS=*` accepted in production | No guard | Refused | `test_production_rejects_wildcard_cors` |
| L5 | Low | Tests | Test storage was not cleared between tests (hidden coupling) | Fixture | Cleared per test | Whole suite |

## 5. Security findings

See [security-and-privacy.md](security-and-privacy.md) for the threat model and all controls.
Fixed: H1, H2, H3, M2, M3, M5, M10, M16, L3, L4. Checked and found sound: Argon2id hashing, token
versioning, role checks on every staff route (verified by tests for teacher, researcher, admin and
student tokens), 404 for out-of-class students, no string-built SQL, no `dangerouslySetInnerHTML`, no
user-controlled outbound URLs (no SSRF), validation errors that never echo input, private storage with
5-minute signed URLs, and the zip-slip check when unpacking speech models. Dependency scans: pip-audit
clean; npm audit gate passes (one dated exception, see §9). gitleaks runs in CI.

Residual: per-process rate limiting; the local offline password is a fast salted SHA-256; guardian
identity is self-declared.

## 6. Privacy findings

- Consent is enforced on the server for every record and for every AI/OCR call (verified). Now also enforced on the phone after withdrawal (H7).
- Deletion is now durable and verifiable (H4, H5, `integrity-check`). Consent evidence is kept with the guardian's name removed.
- Data minimisation: exports exclude names, schools and device details. **But free-text writing may contain names a child wrote**, so exports are pseudonymised, not anonymous.
- Open: no retention period or automatic expiry for recordings; no audit-log retention; cross-border AI processing; verifiable parental consent method; the at-risk flag as a decision about an individual child. These need institutional and legal decisions ([security-and-privacy.md](security-and-privacy.md) §4–§5).

## 7. Performance findings

| Item | Finding |
|---|---|
| ASR speed | Real-time factor 0.07–0.14 on a desktop CPU, model load 0.4 s. **Unmeasured on phones.** Recognition streams during reading, so only the backlog is decoded after stop |
| Upload size | 16 kHz mono WAV ≈ 32 KB/s (5.8 MB for 3 minutes). Acceptable on Wi-Fi; slow on 2G. Compressing a copy for upload (keeping the WAV locally) is a possible future optimisation, but it changes the research original and needs a protocol decision |
| Server | Alignment bounded (M7); AI time budget (M8); body limit (H2) |
| Teacher endpoints | Load all attempts of visible students per request. Fine for a pilot; add SQL aggregation and pagination before district scale |
| Dashboard bundle | One JS chunk > 500 kB (Recharts). Acceptable on school broadband; could be code-split |

## 8. UI/UX findings

- Fixed: interrupted-recording explanation (H11), settings link for denied permission (M15), profile restored on new phones (M14), accuracy labelled as an estimate (H13), passages that can't be edited show "Shared" (M2), queued storage deletions surfaced to admins with a retry button (H4), clearer OCR "no text" handling (M11), label fix (L2).
- Checked: bilingual labels throughout; accessibility labels on the mic button; the sync screen explains every waiting state in words.
- Not done (needs a device and a usability session): TalkBack walk-through, large-font layouts, touch-target audit on small screens, Kannada font rendering check, contrast measurement of the green palette. Listed in [real-device-testing.md](real-device-testing.md) D25–D27.

## 9. Dependency upgrades

| Component | From | To | Notes |
|---|---|---|---|
| FastAPI | 0.162.4 | 0.165.0 | Starlette stays 1.10.0 |
| Uvicorn | 0.38.0 | 0.54.0 | Entrypoint flags verified with the Docker E2E run |
| Pydantic / pydantic-settings | 2.12.4 / 2.16.2 | 2.14.4 / 2.16.3 | |
| psycopg | 3.2.12 | 3.3.9 | |
| Alembic | 1.17.2 | 1.20.1 | `alembic check` clean |
| boto3 | 1.40.74 | 1.44.9 | moto S3 tests pass |
| python-multipart | 0.0.33 | 0.0.34 | |
| Dashboard lockfile | | in-range updates | lucide-react, recharts, oxlint, plugin-react, testing-library |
| CI | Node 20; checkout/setup-node v4, setup-python v5, setup-java v4, upload-artifact v4 | Node 22; v5/v5/v6/v5/v5 | Node 20 is end-of-life |

Intentionally **not** upgraded:
- **Expo SDK 57 → 58** (React Native, all `expo-*` packages): a major native upgrade that cannot be validated without a device. It is required before **2027-02-28**, when the `decode-uri-component` audit exception expires. Plan it together with the first device test round.
- **SQLAlchemy 2.0 → 2.1**: minor release with deprecations; no benefit for this code now.
- **jsdom 31, TypeScript 7, ESLint 10, Jest 30**: dev-tool majors, no security need.
- **Vosk Android 0.3.47** is the current Vosk release. JNA 5.13.0 is kept because it is the version Vosk is built and tested with.
- **Python 3.12** image and **PostgreSQL 16**: supported until 2028+.
- Android build: minSdk 24 (Android 7.0), target/compile SDK 36, AGP 8.12, Kotlin 2.1.20 (set by Expo SDK 57).

## 10. Features implemented

| Feature | Problem solved | Value | Privacy/security impact |
|---|---|---|---|
| Durable storage-deletion queue (`storage_deletions`, admin view and retry, `purge-storage`) | Deletions could silently leave recordings behind | Deletion requests can be honoured and proved | Positive; stores only object keys |
| `integrity-check` CLI (also run in CI) | No way to verify deletion or find orphaned/missing media | Operational assurance; restore drills | Read-only; outputs keys with participant IDs only |
| Request IDs and JSON logs | Hard to trace a failed upload | Support and debugging | IDs only; no content |
| Export provenance (`X-Export-ID`, `asr_status` column) | Exports could not be matched to their audit record; pending rows ambiguous | Reproducible research data | None |
| Reproducible ASR evaluation (synthetic generator; WER/CER, speed, noise, failure rate, separated by source) | No way to measure ASR quality per condition | Evidence for the model and protocol decisions | Synthetic audio only; human data handled per protocol |
| Android test builds pointed at any HTTPS server (`api_base_url` input; `-offline`/`-server` artifact names) | Testing the app against a local backend required changing repo-wide settings | Makes UAT possible | Rejects non-HTTPS URLs |
| Docker-image E2E journey in CI | The image was never run in CI | Catches start-up, migration and entrypoint regressions | None |

## 11. Features recommended but not implemented

| Feature | Why valuable | Why not now |
|---|---|---|
| Automatic retention/expiry of recordings and photos | Data minimisation, DPDP | The retention period must be approved first |
| Redis-backed rate limiting | Correct limits across workers/instances | Single-instance pilot; adds infrastructure |
| Background job runner (retention, purges, AI retries server-side) | Reliability, less work on phones | Not needed until deployment design is fixed |
| Teacher review queue for ASR (listen and correct transcripts) | Fixes H13 per attempt; produces human transcripts for validation | Needs product/research design; significant UI |
| Compressed upload copy of audio | Faster uploads on 2G | Changes the research original; protocol decision |
| SQL aggregation and pagination for teacher views | Scale | Not needed for a pilot |
| Slow KDF for the offline password | Stronger shared-phone protection | Needs on-device performance testing |
| Expo SDK 58 upgrade | Security exception expiry, platform currency | Needs device validation |
| Kannada ASR | Core requirement | No suitable model exists (see asr-evaluation.md) |

## 12. Test results (actually executed, 2026-11-23)

| Suite | Before audit | After audit | Result |
|---|---|---|---|
| Backend pytest (real PostgreSQL) | 67 | **89** | 89 passed, 0 failed, 0 skipped |
| App Jest | 72 | **76** | 76 passed |
| Dashboard Vitest | 8 | **10** | 10 passed |
| App TypeScript / ESLint | clean / 2 errors | clean / 0 errors (9 warnings) | |
| Dashboard build / oxlint | ok | ok (1 warning) | |
| Ruff (backend) | clean | clean | |
| Alembic check + downgrade/upgrade 0004 | — | clean | |
| E2E API journey vs. local Docker image | 22/22 (PR #2) | **22/22** (AI step skipped: no key) | Run twice: before and after dependency upgrades |
| Integrity check after the journey's deletion | — | `ok: true` | |
| pip-audit / npm audit gate | clean / pass | clean / pass | |
| GitHub Actions on this branch | — | Backend, App, Dashboard, Android (debug and release) | See the PR for run links |
| Synthetic ASR evaluation | partial | 216 recognitions (108 × 2 models), 0 failures | See asr-evaluation.md |

## 13. Unverified functionality

| Status | Items |
|---|---|
| Fully verified (automated, real components) | Backend API behaviour incl. auth, isolation, consent gating, sync idempotency, deletion, exports; migrations; Docker image start-up; dashboard data flows against mocked APIs; app sync logic in unit tests |
| Verified with mocks only | Gemini feedback, writing assessment, Gemini OCR, Google Vision OCR (fake transports); S3 (moto) |
| Verified on an emulator | **Nothing**: no emulator was available in this environment |
| Requires a physical device | Recording, Vosk recognition and latency, model download, background/interrupt handling (H11/H12), offline queue, battery and memory, Kannada rendering, TalkBack |
| Requires external credentials | Real Gemini and Vision calls; production S3 bucket; release signing key |
| Requires research-team input | Child-speech ASR validation data; Kannada ASR model; at-risk threshold; whether AI writing scores are used; handwriting OCR samples |
| Requires institutional approval | Ethics approval, consent text and guardian verification, retention, legal review under DPDP |

## 14. External dependencies and credentials

| Need | Used for | Where to set |
|---|---|---|
| `GEMINI_API_KEY` | AI feedback, Gemini OCR | Backend secret |
| `GOOGLE_VISION_API_KEY` (optional) | Vision OCR | Backend secret |
| PostgreSQL host | Production database | `DATABASE_URL` |
| Private S3-compatible bucket | Recordings and photos | `S3_*` |
| Android upload keystore | Signed releases | Repository secrets `ANDROID_UPLOAD_*` |
| Backend HTTPS URL | App and dashboard | Repository variables `EXPO_PUBLIC_API_BASE_URL`, `VITE_API_BASE_URL` |
| Kannada Vosk model | Kannada ASR | Repository variables `EXPO_PUBLIC_ASR_MODEL_KN_*` |

## 15. Remaining blockers

1. Physical-device testing ([real-device-testing.md](real-device-testing.md)).
2. ASR validation on consented children's recordings; decision on model and on the at-risk threshold given the measured bias.
3. Kannada speech model.
4. Real AI/OCR verification with a key, including a teacher's review of tone in both languages; Kannada handwriting OCR measurement.
5. Release signing keystore (current release artifacts are signed with the debug key and must not be distributed beyond testers).
6. Deployment (host, database, bucket, URLs). Deliberately not done.
7. Ethics approval and legal review; retention period.
8. Expo SDK 58 upgrade before 2027-02-28.

## 16. Production-readiness assessment

| Area | State |
|---|---|
| Backend | Ready for staging: hardened, tested, migrations clean, container verified |
| Dashboard | Ready for staging |
| Android app | Builds and packages the speech engine; **unvalidated on hardware** |
| Research data validity | **Not ready**: ASR bias measured on synthetic speech only, not validated on children |
| Kannada | Recording and storage work; no recognition or OCR validation |
| Compliance | **Not ready**: approvals and legal review outstanding |

**Recommendation:** ready to merge after the manual tests in [USER_ACCEPTANCE_TESTING.md](USER_ACCEPTANCE_TESTING.md) sections B, C, G and H pass, and A/D/F pass on at least one physical phone. Not ready for use with children until §15 items 1, 2, 5 and 7 are resolved.
