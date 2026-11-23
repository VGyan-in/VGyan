# Release checklist

Use for every pilot or store release. Tick each item and keep the completed copy with the release notes.

## A. Approvals (blocking)
- [ ] Ethics committee approval covers this app version's data collection, consent text and retention.
- [ ] Legal review of the DPDP questions in [security-and-privacy.md](security-and-privacy.md) §5.
- [ ] Schools' written agreement; named data protection contact in the consent text and app.
- [ ] Retention period for recordings and photos agreed (and implemented or scheduled as a manual task).

## B. Code and CI
- [ ] Release branch merged to `main` through a reviewed PR.
- [ ] All workflows green on the release commit: CI - Backend (tests, migrations, Docker image, E2E journey, integrity check), CI - Quality & Tests, CI - Teacher Dashboard, Security & Audit.
- [ ] `audit-exceptions.json` has no expired entries. (`decode-uri-component` expires 2027-02-28: upgrade to Expo SDK 58 before then.)
- [ ] `app.json` `version` and `android.versionCode` bumped.
- [ ] `CONSENT_VERSION` (server) equals `EXPO_PUBLIC_CONSENT_VERSION` (build).

## C. Android artifact
- [ ] Upload keystore secrets set (`ANDROID_UPLOAD_KEYSTORE_BASE64`, `..._STORE_PASSWORD`, `..._KEY_ALIAS`, `..._KEY_PASSWORD`). **A `-debug-key` artifact must never be distributed beyond testers.** Keep the keystore and passwords in two separate safe places; losing them means you can never update the app.
- [ ] Built from a tag `vX.Y.Z` (or a manual `release` run) with `EXPO_PUBLIC_API_BASE_URL` = production HTTPS URL. Artifact name ends `-release-upload-key-server`.
- [ ] CI step "Verify speech engine is packaged" passed (libvosk.so and libjnidispatch.so for arm64-v8a and armeabi-v7a; VgyanSpeechModule and Vosk classes in the dex).
- [ ] Download the APK, check its SHA-256 against `SHA256SUMS.txt`, and verify the signature: `apksigner verify --print-certs app.apk` shows the upload certificate, not "Android Debug".
- [ ] Debug/release separation: release is not debuggable (`aapt dump badging app.apk | findstr debuggable` prints nothing).
- [ ] Real-device matrix in [real-device-testing.md](real-device-testing.md) passed on at least one low-end and one mid-range phone with **this** build.

## D. Backend
- [ ] `ENV=production`, strong `JWT_SECRET`, `STORAGE_BACKEND=s3` with a private bucket, `CORS_ORIGINS` = dashboard origin, `TRUSTED_PROXY_HOPS` set for the host, `LOG_FORMAT=json`.
- [ ] Bucket: no public access, encryption on, versioning with a lifecycle rule for non-current versions.
- [ ] Database backups and point-in-time recovery enabled; restore drill done (database.md).
- [ ] `GET /health/ready` → `ok`, migration = latest.
- [ ] Admin account created; temporary password changed by creating a personal admin and deactivating the bootstrap account, or stored in a password manager.
- [ ] `tools/e2e/api_journey.py` passes against production (it cleans up after itself) and `python -m app.cli integrity-check` prints `"ok": true` afterwards.
- [ ] If AI is enabled: a real `/ai/reading-feedback`, `/ai/writing-assessment` and `/ocr` call checked by a person for tone and correctness in English and Kannada.

## E. Dashboard
- [ ] Repository variable `VITE_API_BASE_URL` set; Pages deploy green; login works from a school network.

## F. Data quality gates (research)
- [ ] ASR validated on consented human recordings per [asr-evaluation.md](asr-evaluation.md), or the release notes state that accuracy figures are unvalidated estimates.
- [ ] Kannada handwriting OCR measured, or Kannada writing limited to typed input.

## G. After release
- [ ] Monitor logs and `/admin/storage-deletions` daily for the first week.
- [ ] Weekly `integrity-check`.
