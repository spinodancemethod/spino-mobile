# Local Video Relink and Recovery

## Goal

Allow a user to restore a local source video on a new device without recreating the cloud video record or its segments.

The permanent identity is `video_uploads.id`. A successful relink may update only the record's local-device reference and availability metadata. It must never update `segments.video_upload_id`, create another `video_uploads` row, or upload source-video bytes.

## Current Architecture

```text
video_uploads.id
  -> segments.video_upload_id
  -> current local URI in video_uploads.fallback_uri
```

Existing source-video metadata is stored in `video_uploads` and segments already reference the generated UUID, not the local URI. The current replacement flow in `lib/hooks/useLocalVideoLibrary.ts` preserves the `local_reference_key`, then calls `useSyncVideoUpload`, which upserts by `(user_id, local_reference_key)`.

The direct local-URI consumers to move behind the resolver are:

- `app/(private)/video-upload/[id].tsx` for playback and thumbnail generation.
- `lib/hooks/useRoadmapSegments.ts` for roadmap video URI projection.
- `lib/hooks/useLocalVideoLibrary.ts` for the local-video workspace.

The current database fields map to the requested vocabulary as follows:

| Recovery concept | Existing field | Action |
| --- | --- | --- |
| Permanent video identity | `video_uploads.id` | Keep unchanged |
| Current local reference | `fallback_uri` | Reuse; it is mutable |
| Current device media identifier | `media_identifier` | Reuse; it is mutable |
| Initial filename | `filename` | Add immutable `original_filename` |
| File size | `file_size_bytes` | Reuse |
| Duration | `duration_seconds` | Reuse |
| Content identity | none | Add `content_hash` |

## Decisions Before Implementation

### Hashing capability

`package.json` does not currently include a native SHA-256 library, and `expo-file-system/legacy` does not expose a hashing API. The implementation must first prove a production-capable way to hash an Expo image-picker URI on iOS and Android without uploading it.

Preferred outcome: approve one maintained native-compatible hashing library, then hide it behind a small `lib/videoHash.ts` adapter with a mockable byte reader. Do not substitute filename, size, or duration for the hash.

### Legacy cloud records

Existing rows cannot be given a truthful SHA-256 value with a SQL migration because the source files never reach Supabase. The migration should therefore leave `content_hash` nullable for legacy records and set `original_filename` from `filename` or `name` where possible.

Product decision required: legacy rows with no hash must never be silently relinked. The safe first implementation is to show them as unavailable and offer a separate "re-establish this source video" flow that hashes a currently accessible original before future device recovery. A hashless row must not accept a candidate based on metadata alone.

### Database migration validation

The current Jest suite has no database migration harness. Before claiming the migration regression requirement is automated, add a repeatable test-database path (for example, a Supabase local/CI integration test) that applies the migration to seeded `video_uploads` and `segments` rows. A unit test alone cannot prove a PostgreSQL migration preserves foreign keys and records.

## Milestones

Each milestone is independently reviewable. Run its focused Jest tests and `npm run typecheck` before beginning the next one. Do not start automatic discovery until manual relinking is working end to end.

### M1: Establish the contract and test harness

Scope:

- Add pure TypeScript types for asset resolution, candidate metadata, verification results, and relink outcomes.
- Write unit tests for the permanent-ID invariant using in-memory records.
- Establish the repeatable database migration test path described above.

Acceptance criteria:

- A test demonstrates that missing media leaves the upload ID and all `segment.video_upload_id` values unchanged.
- The database test seeds a video with multiple segments and verifies that the schema migration preserves all IDs and relations.

Likely files:

- `lib/models.ts`
- new `lib/videoAssetResolver.ts` and tests
- new migration test support, if the project test environment is configured for it

### M2: Make the schema recovery-safe

Scope:

- Add an ordered migration for `video_uploads.original_filename` and `video_uploads.content_hash`.
- Backfill `original_filename` from `filename`/`name` only when it is null.
- Keep `content_hash` nullable for existing rows; do not invent a hash.
- Add the new columns to `sql/bootstrap/01_tables.sql` so fresh projects match migrations.
- Update `VideoUploadRecord` and insert/upsert payload types.

Acceptance criteria:

- Existing `id`, `fallback_uri`, and segment foreign keys are unchanged after applying the migration.
- `original_filename` is not updated by any relink mutation.
- RLS continues to allow owners to update only their own upload row.

### M3: Capture immutable import metadata and SHA-256

Scope:

- Implement the hashing adapter selected in the prerequisite decision, including cancellation/error handling for disappearing files.
- On initial import in `app/(private)/(dashboard)/add-video.tsx` and `useLocalVideoLibrary`, gather the image-picker filename, size, and duration, calculate the content hash locally, then persist the complete record.
- Ensure the import flow creates metadata and segments only after the video row is saved successfully.

Acceptance criteria:

- Same bytes produce the same SHA-256 and different bytes produce a different SHA-256 in unit tests.
- New records contain `original_filename`, `file_size_bytes`, `duration_seconds`, and `content_hash`.
- No request uploads video bytes; the only network operation is metadata/segment persistence through existing TanStack Query hooks.

### M4: Introduce `VideoAssetResolver`

Scope:

- Create a resolver that takes `VideoUploadRecord` or its ID plus a repository lookup and returns either `{ status: 'AVAILABLE', uri }` or `{ status: 'NEEDS_RELINK' }`.
- Validate `fallback_uri` with the existing `expo-file-system` availability check before returning a playable URI.
- Treat invalid, inaccessible, and stale URI cases as `NEEDS_RELINK`, not as playback exceptions.
- Replace direct `fallback_uri` use in playback, thumbnail generation, and roadmap projection with this API.

Acceptance criteria:

- A missing URI resolves predictably without throwing.
- The detail screen does not pass an unvalidated URI to `LocalSegmentPlayer` or `expo-video-thumbnails`.
- Existing accessible videos still play and generate thumbnails.

### M5: Preserve segments while media is missing

Scope:

- Refresh availability through the resolver when a video is loaded or selected.
- Add a narrow update mutation that changes local availability without deleting the upload or its segments.
- Remove the current implication that "Replace video" means replacing the source identity; retain explicit removal as the only cascade-delete action.

Acceptance criteria:

- Deleting access to one local URI makes only that video `NEEDS_RELINK`.
- Its segments remain queryable and retain their original `video_upload_id`.
- Other videos remain independently available.

### M6: Manual candidate verification and atomic relink

Scope:

- Implement a pure `verifyCandidate(videoUpload, candidate)` service with this ordered behavior: accessible -> size prefilter -> duration prefilter -> SHA-256 equality.
- Size and duration may reject candidates early, but only a matching hash can succeed. Filename is display-only and must not affect acceptance.
- Add a dedicated TanStack Query mutation in `lib/hooks/` that, after verification succeeds, updates only `fallback_uri`, `media_identifier`, availability, and timestamps using `eq('id', videoUploadId).eq('user_id', userId)`.
- Do not call the current `useSyncVideoUpload` upsert for relinking. It is an import/upsert API keyed on `local_reference_key`, not the permanent upload ID.
- Invalidate `videoUploads`, video-detail, segment, and roadmap projections only after the update succeeds.

Acceptance criteria:

- A renamed original file relinks successfully.
- Files sharing a filename, size, or duration but not a hash fail.
- A simulated update failure reports failure, leaves the old URI intact, and does not change any IDs or segment relations.
- The mutation does not send source-video bytes to Supabase.

### M7: Recovery UI

Scope:

- Add a recovery entry point in the local-video workspace or a dedicated authenticated route, following the existing themed component patterns.
- List only unavailable or relink-required records with original filename, segment count, current status, and an icon/action to select a local video.
- Keep picker, hashing, validation, and Supabase updates in hooks/services; the route only triggers the flow and presents status.
- Use a clear nontechnical mismatch message and show success only after the mutation resolves.

Acceptance criteria:

- Successful recovery reports the recovered video and its segment count.
- A wrong selection does not change the database or display a success state.
- Partial recovery leaves unrelated unavailable videos recoverable.

### M8: Automatic candidate discovery

Scope:

- Add discovery only after M7 is stable.
- Filter candidates by file size and duration before calculating hashes.
- Hash only the filtered candidates and accept exact `content_hash` equality.
- Define deterministic duplicate handling: present the matching paths to the user, or choose a documented deterministic priority. Never choose randomly.

Acceptance criteria:

- Tests instrument the hash adapter and prove unrelated candidates were not hashed.
- Multiple identical candidates follow the documented deterministic behavior.
- Hashless legacy records are excluded from automatic recovery.

### M9: End-to-end migration and failure suite

Scope:

- Add a device-A/device-B integration scenario backed by a seeded database and mocked local assets.
- Cover wrong file, renamed file, corruption, missing file during hashing, app interruption/cancellation, database update failure, multiple missing videos, partial recovery, and no-media-upload assertions.

Acceptance criteria:

- Before and after a successful relink, `video_uploads.id` and every related `segments.video_upload_id` are byte-for-byte identical.
- Every rejected or interrupted attempt leaves the record recoverable.
- The regression suite covers both manual relinking and automatic-discovery safeguards.

## Execution Order

1. Resolve the hashing and legacy-record decisions.
2. Complete M1 and M2 before changing user-visible flows.
3. Complete M3 through M6 as the smallest functional recovery path.
4. Complete M7, then validate on an iOS and Android development build using an actual media-library asset.
5. Only then complete M8 and M9.

## Initial Verification Commands

```sh
npx jest lib/videoHash.test.ts --runInBand
npx jest lib/videoAssetResolver.test.ts --runInBand
npm run typecheck
npm test
```

The first implementation slice should be M1/M2 only: establish the schema contract and the migration test path, without changing replacement UI behavior.