# Security and privacy

VGyan processes children's personal data: names, voice recordings, photos of handwriting, school
details and assessment results. This document covers the threat model, the controls in the code, and,
in separate sections, what still needs institutional approval, legal review or operational process.

**Technical controls do not make the project legally compliant on their own.** Nothing here is legal
advice.

## 1. Threat model

| Asset | Threat | Main controls |
|---|---|---|
| Recordings, handwriting photos | Public exposure, access by the wrong teacher | Private bucket; short-lived signed URLs (300 s); class-scoped access checks; every media URL request is audited |
| Student names and profiles | Leak to researchers or other schools | Researchers get no named records; exports use the participant ID only; teachers see only assigned classes (404, not 403, for others) |
| Accounts | Credential stuffing, brute force | Argon2id hashes; per-IP and per-account rate limits; constant-time "no such account" path; token versioning ("sign out everywhere", deactivation) |
| Research dataset | Data from withdrawn participants; tampering | Exports include only participants whose latest consent is active with research consent; each export is logged with SHA-256, row count and filters |
| Server | Disk/memory exhaustion | Body-size cap before parsing (`MAX_REQUEST_MB`); per-file caps; bounded alignment; Pillow pixel cap; time budget for AI calls |
| Third-party AI (Gemini) | Child data sent without consent; prompt injection | Calls only with active research consent on the server; student text is escaped inside data tags; output is schema-validated and filtered against the input |
| Shared school phones | One child seeing or uploading another child's data | Local password per student; uploads are sent only for the signed-in student; local media paths use participant IDs |
| Logs | Personal data or secrets in logs | Route templates only (no paths, query strings or bodies); audit details hold IDs and counts; HTTP client URL logging disabled; validation errors never echo input |

## 2. Implemented technical controls

### Authentication and sessions
- Passwords: Argon2id (`argon2-cffi`) on the server. Staff passwords need 10+ characters; student passwords 6+ (young children).
- JWT (HS256) with `exp`, `sub`, `role`, `ver`, `jti`. Every request re-checks that the account is active and that `ver` matches `token_version`. Deactivation, "sign out everywhere" and deletion all bump the version.
- A token with a malformed subject is rejected with 401 (it was a 500 before this audit).
- Production refuses to start with the development JWT secret, a secret under 32 characters, non-S3 storage, or `CORS_ORIGINS=*`.
- Dashboard tokens live in `sessionStorage` and disappear when the tab closes (shared school computers). The app keeps its token in the Android Keystore (`expo-secure-store`).

### Authorization
- Roles: student, teacher, researcher, admin. Teachers see students only in classes linked to them in `teacher_classes`. Researchers see no named records. Admins see everything.
- Student IDs from other classes return 404 so their existence is not revealed.
- Sync endpoints refuse records whose participant ID differs from the token (403), and attempts can link only to the student's own device session (fixed in this audit).
- Teachers can edit only passages they created. Seeded research passages are edited by an admin (fixed in this audit).

### Rate limiting
- In-process sliding windows: registration 10/h per IP; student login 30/5 min per IP and 10/5 min per account; staff login 20/5 min per IP and 8/5 min per e-mail; AI 30/10 min per student; OCR 20/10 min per student.
- `X-Forwarded-For` is ignored unless `TRUSTED_PROXY_HOPS` is set (fixed in this audit; before, any client could send a fresh fake IP with each request). Uvicorn trusts forwarded headers only from `FORWARDED_ALLOW_IPS` (default `127.0.0.1`).
- Limits are per worker process. Use a shared store such as Redis before running more than one instance.

### Input handling
- Pydantic validation on every body. File types are identified from their content, not the client's MIME type. Size caps apply per file and per request.
- SQL is built only with SQLAlchemy expressions (no string-built SQL).
- The dashboard renders all data as React text (no `dangerouslySetInnerHTML`).
- Research CSV cells starting with `=`, `+`, `-`, `@`, tab or CR get a leading apostrophe so spreadsheet software does not run them as formulas. **Analysts:** strip a leading `'` from text fields before analysis.
- Fetches to providers go only to fixed Google endpoints (no user-controlled URLs, so no SSRF surface).

### Storage and media
- Objects are content-addressed (`{kind}/{participant_id}/{attempt_id}/{sha256}.{ext}`), written once, and never public. Keys contain participant IDs, never names.
- Checksums are verified **before** an object is written. A mismatch leaves nothing behind (fixed in this audit).
- Signed URLs expire after `SIGNED_URL_TTL_SECONDS` (default 300). The S3 client asks for server-side encryption, with a fallback for stores (such as R2) that always encrypt.

### Consent, withdrawal and deletion
- No reading or writing record is accepted, and nothing goes to Gemini, without an active consent record with research consent on the server (`428` until it arrives). Audio is stored only with audio consent, and photos only with handwriting consent.
- A withdrawn consent cannot be reactivated. A new consent record must be signed.
- After withdrawal the phone uploads nothing new; only the withdrawal itself is sent (fixed in this audit).
- Withdrawn participants disappear from research exports immediately.
- Deletion requests are created by the student and completed by an admin, so nothing is deleted silently. Completing one:
  1. deletes attempts, revisions, AI and OCR records, teacher comments and device sessions;
  2. anonymises the account (name, e-mail, profile, class link, password) and blocks sign-in;
  3. keeps consent records with the signer's name removed, as evidence;
  4. queues every stored object in `storage_deletions` **in the same transaction**, commits, then deletes the objects. Failures stay queued and are shown on the admin page. Retry with the "Retry now" button or `python -m app.cli purge-storage` (new in this audit; before, a storage error lost the keys and left the recordings behind with no record).
- `python -m app.cli integrity-check` verifies that nothing is left behind (see §5).

### Audit trail
`audit_log` records registration, logins, consent changes, every sync, teacher views of a student, every media URL, comments, passage edits, assignments, exports and all admin actions. It holds IDs and counts only, never names or content. Each research export is also recorded in `research_exports` (SHA-256, row count, filters, requester) and returned with an `X-Export-ID` header.

### Transport and headers
- The app blocks cleartext HTTP (`usesCleartextTraffic=false`). Android backup is disabled (`allowBackup=false`).
- API responses carry `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Cache-Control: no-store`, `X-Request-ID`, and HSTS in production.
- CORS allows only the configured dashboard origins, without credentials.

### Secrets
- AI/OCR keys exist only on the server. Google Vision's key is now sent in a header (it was in the URL, which `httpx` logged at INFO level). `httpx`, `httpcore` and `botocore` logs are raised to WARNING.
- The repository is scanned with gitleaks (full history) in CI. No signing keys or credentials are committed. `StudentSkillManager-main/` (contains third-party secrets) is git-ignored and must never be committed.

### Dependencies
- `pip-audit` (backend) and an `npm audit` gate (app, dashboard) run in CI. Current state: no known backend or dashboard vulnerabilities. The app has one documented exception (`decode-uri-component`, on-device DoS via malformed deep links, fixed by Expo SDK 58; exception expires 2027-02-28).

## 3. Data inventory and minimisation

| Data | Where | Why | Retention today |
|---|---|---|---|
| Student name, optional e-mail, password hash | `students` | Sign-in; teacher's class list | Until deletion |
| Background profile (grade, school, medium, languages, age group, gender) | `students.profile` | Research covariates | Until deletion |
| Guardian name and relation | `consent_records` | Evidence of consent | Kept after deletion with the name removed |
| Voice recordings (WAV) | Object storage; the phone until confirmed synced (if purge is enabled) | Research original; teacher review | Until deletion. **No automatic expiry yet.** |
| Handwriting photos | Object storage (attempt image + OCR image) | Research original | Until deletion. **No automatic expiry yet.** |
| Transcripts, metrics, AI feedback | Database | Assessment | Until deletion |
| Device model and OS version | `sessions` | Reproducibility | Until deletion |
| Audit log | Database | Accountability | **No retention period set** |

Research exports exclude names, e-mails, guardian names, school names and device details. They do include free text (transcripts, writing). **A child may write their own name, a friend's name or the school's name in a writing task**, so the writing export is pseudonymised, not anonymous. Treat it as personal data.

## 4. Requires institutional (ethics committee / school) approval

1. The research protocol, including the purpose of each data item, the retention period for recordings and photos, and who may access what.
2. The consent and assent text in English and Kannada (`client/src/app/consent.tsx`, version `CONSENT_VERSION`), and how a guardian's identity and relationship are confirmed. Today a guardian types their name and relationship on the child's phone. Whether that is acceptable evidence is a protocol decision.
3. Whether children may self-sign (the app allows `signerType = student`) and from what age.
4. The at-risk flag (below 75% ASR-estimated accuracy). ASR under-counts correct words (see `docs/asr-evaluation.md`), so the flag can mark good readers. Its use with teachers needs approval.
5. Use of AI-generated writing scores as research outcomes before they are compared with teacher ratings.
6. Whether teachers may hear recordings and see AI feedback, and whether parents receive results.
7. The processes for handling deletion requests and data breaches, and a named data protection contact.
8. Whether data from a participant who withdraws is kept for analysis up to the withdrawal date (the code stops new collection and removes them from exports; their existing rows stay in the database until a deletion request is completed).

## 5. Legal questions for qualified review (India)

The Digital Personal Data Protection Act, 2023 applies, and the DPDP Rules, 2025 were notified on 13 November 2025 with staggered commencement. Several provisions relevant here, including the children's verifiable-consent rule and the research exemption, are reported to take effect 18 months after notification (13 May 2027). Secondary sources disagree on rule numbering between the draft and final Rules, so counsel should work from the official Gazette text.

Questions for counsel:
1. **Who is the Data Fiduciary:** the university or research group, the school, or both? Who processes on their behalf (the hosting provider, Google for Gemini/Vision)?
2. **Verifiable parental consent (Act s. 9(1) and the corresponding Rule):** does the app's guardian-consent screen meet the standard once it applies? If not, what method is acceptable (for example a signed paper form recorded by the school, or DigiLocker-based verification)?
3. **Exemptions:** do the Fourth Schedule exemptions for educational institutions, or the research/statistical exemption (subject to the Second Schedule standards and the condition that data is not used for decisions about the individual child), apply? The at-risk flag shown to teachers may be a "decision specific to the Data Principal".
4. **Behavioural monitoring of children (s. 9(3)):** does per-child performance tracking and AI feedback count, and is it covered by an exemption?
5. **Cross-border transfer:** Gemini and Vision process data outside India. Is this permitted for this purpose, and does the hosting region of the database and bucket matter?
6. **Retention and erasure:** what retention period applies to recordings once the purpose is served, and what must happen to exports already given to researchers when a participant asks for deletion?
7. **Breach notification:** the obligations and timelines to the Data Protection Board and to guardians.
8. **Grievance redressal:** contact details that must appear in the app and consent text.

## 6. Operational requirements (not code)

- A named owner for the admin account. Enable MFA on the hosting, database and bucket consoles. Never share the admin password.
- Rotate `JWT_SECRET` and provider keys if exposure is suspected (rotating `JWT_SECRET` signs everyone out).
- Backups: daily PostgreSQL backups with point-in-time recovery from the host, and versioning or replication on the bucket. Note that bucket versioning keeps deleted recordings as old versions: add a lifecycle rule that expires non-current versions after a short, approved period, or deletion is not complete. **Test a restore** before the pilot, and after any restore re-apply completed deletions (the `storage_deletions` and `deletion_requests` tables list them).
- Run `python -m app.cli integrity-check` weekly and after every deletion. It must print `"ok": true`.
- Process deletion requests within the period set by the protocol. Check the admin page for queued file deletions.
- Configure phones as school devices: screen lock, no shared Google accounts, and sign each child out after a session.
- Review the audit log for unusual media access (many `media.audio_url` events by one account).

## 7. Known residual risks

| Risk | Severity | Mitigation / next step |
|---|---|---|
| Rate limits are per process | Medium | Redis-backed limiter before scaling out |
| Local password on shared phones is salted SHA-256 (fast hash) | Medium | Move to a slow KDF on the device; offline sign-in is a convenience, the server uses Argon2id |
| Guardian identity is self-declared in the app | High (legal) | Protocol decision (§4.2, §5.2) |
| No automatic retention or expiry of recordings | Medium | Implement once the retention period is approved |
| Writing export can contain names written by children | Medium | Manual review or redaction before sharing outside the core team |
| Third-party AI processing abroad | Legal question | §5.5 |
