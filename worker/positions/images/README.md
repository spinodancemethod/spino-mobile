# Reference images for Bachata positions

One sub-folder per position `id` in `../positions.json`. Drop example photos into the
matching folder; the classifier picks them up automatically (no JSON edit needed).

Source: `testPositionsDoc/bachata_position_reference.md` (No. = row in that document).

Condensed vocabulary (2026-11-01): positions that differ only by which hand or arm is used share one
family folder. Side-specific ids exist in `positions.json` as inactive children for later.

| Doc rows | Folder | Position |
|---|---|---|
| 1 | `basic_sensual/` | Close Sensual Position |
| 2 | `basic/` | Open Position (Basic) |
| 3-4 | `cross_hand/` | Cross-Hand (either arm on top) |
| 5-6 | `handshake/` | Handshake Hold (LL or RR) |
| 7 | `shadow/` | Shadow – Follower in Front |
| 8 | `reverse_shadow/` | Reverse Shadow – Leader in Front |
| 9 | `cuddle/` | Cuddle / Wrap – Follower in Front |
| 10-11 | `side_by_side/` | Side-by-Side (leader either side) |
| 12 | `shadow_back_to_back/` | Back-to-Back |
| 13-16 | `hammerlock/` | Hammerlock (any arm) |

Rules:
- Formats: `.jpg`, `.jpeg`, `.png`, `.webp`. iPhone `.heic` must be converted to JPEG first.
- Only the first 3 images per folder (sorted by filename) are sent, to keep the cached prompt small.
- Images are downscaled to 768 px on the long edge before upload, so full-size phone photos are fine.
- Best photos: both dancers fully in frame, hands clearly visible, taken from roughly where a
  phone would film a class (front-on, standing height).
- Renaming or re-ordering files changes the prompt and invalidates the prompt cache for one run; harmless.
