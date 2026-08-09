COPILOT BUILD TASK — Dance Memory MVP
1. Project Context
We are building a mobile dance-learning application for iOS and Android using Expo React Native.
The purpose of the application is to help dancers retain choreography and movement patterns learned in dance classes.
The primary target user is a social/improvised dancer learning things such as:
    • Salsa
    • Bachata
    • Dominican
    • Sensual
    • Other partner/social dance styles
The application is not primarily intended to store complete choreographies. It is intended to turn class demonstration videos into small, searchable movement references that the dancer can revisit and practise.
For example, a single class video might produce segments such as:
    • Basic on 1
    • Basic on 5
    • Cuddle position
    • Shadow
    • Turn
    • Transition
    • Sensual movement
The key product concept is:
    The user's videos remain on their device. The application stores references to those videos and creates structured, timestamped segments around them.
The application should NOT become a video-hosting platform.

2. Existing Technology
The project already contains:
    • React Native
    • Expo
    • Existing application/navigation
    • User authentication
    • Supabase
    • RevenueCat
Do NOT rebuild:
    • Authentication

    • Subscription infrastructure
    • RevenueCat integration
    • Existing application shell/navigation unless required for the new functionality
The new work should integrate into the existing application.

3. MVP Scope
The MVP should focus on this core workflow:
Select local video
        ↓
Create video record
        ↓
Extract audio
        ↓
Speech-to-text
        ↓
Detect spoken counts
        ↓
Generate candidate 8-count segments
        ↓
User reviews/edits segments
        ↓
User categorises segments
        ↓
Save segment metadata
        ↓
Play individual segments later
The actual video remains on the user's device.

4. Add Video
Create an Add Video flow. A video upload record is the source record for all
segments derived from it; a separate choreography entity is not required for
the MVP. The term upload refers to adding a local video reference, not sending
the video to our server.
The user enters:
    • Video/session name
    • Optional dance style
Dance style should initially support a predefined list such as:
    • Salsa
    • Bachata
    • Dominican
    • Sensual
    • Other
The architecture should allow the user to add/customise their own dance styles later.
Then:
Add Video
Open the native iOS/Android media picker.
The user selects an existing video.
The source video must NOT be uploaded to Supabase Storage.

5. Local Video Reference
After selecting the video, create a `video_uploads` record backed by the
operating system's media-library identifier. Retain the identifier indefinitely
in Supabase and re-resolve it whenever the app needs to play the video. This
avoids duplicating the original video.

An identifier can be retained indefinitely, but it cannot guarantee indefinite
playback: the user may delete the asset, revoke permission, migrate devices, or
the operating system may stop resolving it. These cases must result in the
defined unavailable state rather than an attempt to recreate or upload the
video.

Store as much persistent metadata as the operating system makes available.
Potential fields:
    • Local/media identifier
    • Filename
    • Duration
    • Creation date
    • MIME type
    • File size
    • Thumbnail
    • Platform
    • Reference status
    • Local content fingerprint
    • Fingerprint algorithm/version
The application must distinguish between:
AVAILABLE
MISSING
ACCESS_DENIED
UNKNOWN
Do not use the filename alone as the identity of a video. The reference adapter
must account for platform differences: iOS asset identifiers and Android media
store/content identifiers are the preferred identity, while the URI is a
re-resolved playback locator rather than the sole identity.

OS identifiers are device/library references and are recovery hints, not a
guaranteed cross-device identity. Generate a content fingerprint locally when
the video is first selected. Store only the fingerprint, algorithm/version, and
supporting metadata in Supabase; never upload the video to create the
fingerprint. The fingerprint should be designed for efficient mobile
processing, for example a hash of stable metadata plus sampled file data rather
than an unnecessarily expensive full-file hash.

If the operating system cannot provide a stable media identifier, persist the
best available URI plus file metadata and mark the identity as best-effort.
This case must be handled explicitly rather than silently treating a temporary
picker URI as permanent. Keep both strategies available: prefer a native asset
identifier, but support a best-effort URI fallback where platform APIs require
it.

Cross-device recovery should use this flow in a future phase:
    1. Restore video metadata, fingerprints, categories, and segments from Supabase.
    2. Scan videos available through the new device's media library.
    3. Compare fingerprints and supporting metadata against the restored records.
    4. Automatically propose only high-confidence matches.
    5. Require user confirmation for matches below the high-confidence threshold.
    6. Mark unresolved records as unavailable and allow manual replacement.

The app must never silently bind a possibly different video to existing
segments. A confirmed match updates the local media binding while preserving
the Supabase video and segment records.

6. Video Storage
The original video remains on the user's device.
Do NOT:
    • Upload the full video to Supabase Storage
    • Permanently store a copy of the video on the server
    • Create a cloud video library
    • Automatically upload the video to an AI provider
Supabase stores metadata and references only.
The application should play the video directly from the user's device.
If the video is later unavailable, display:
    Video unavailable
with:
Choose replacement video
and:
Remove reference
The user's video and segment metadata should not automatically be deleted when
media becomes unavailable. Replacement is a user-confirmed operation: the user
must verify the existing segment boundaries against the replacement and may edit
or remove any invalid segments. The replacement must not silently change the
video identity or invalidate metadata without user review. Store the replacement
media binding on the existing `video_uploads` record, preserve the segments for
review, and record that replacement review is pending.

7. Video Player
Create a reusable video player component.
Required functionality:
    • Play/pause
    • Seek
    • Current time
    • Duration
    • Full-screen
    • Playback speed
    • Loop
    • Start time
    • End time
The player must support:
playSegment(video, startTime, endTime)
A segment must be represented as a timestamp range against the original video.
Example:
Segment:
startTime = 32.4
endTime = 37.1
When the segment is played:
    1. Seek to 32.4 seconds
    2. Play
    3. Stop at 37.1 seconds
    4. Support looping
Do not create a separate video file for each segment.

8. Video Uploads and Segment Data Model
Use Supabase/PostgreSQL for the application's structured data.
The database stores metadata around the user's video, not the video itself.

user_roadmaps
Suggested fields:
id
user_id
name
description
created_at
updated_at

video_uploads
Suggested fields:
id
user_id
roadmap_id
name
created_at
updated_at
platform
media_identifier
content_fingerprint
fingerprint_algorithm_version
filename
duration
mime_type
file_size
creation_date
thumbnail_reference (local URI or regenerable local cache key)
status
segments
Suggested fields:
id
user_id
video_upload_id
sequence
start_time
end_time
count_start
count_end
category_id (required; every segment must have a category)
user_notes
ai_confidence
ai_generated
user_confirmed
created_at
updated_at
A segment references:
video_upload_id
+
start_time
+
end_time
It does not reference or contain a physical video file. `start_time` and
`end_time` are seconds in the original video, with `start_time < end_time`.
`end_time` is inclusive for playback and preview. Manual overlaps are allowed.
The preview shown to the user is the range that will be preserved in the saved
segment metadata.
Example:
Segment 3
Video:
IMG_4821.MOV
Start:
32.4 seconds
End:
37.1 seconds
Counts:
17–24
Category:
Cuddle Position

9. Segment Categories
Segments should be categorised so the dancer can quickly find useful movement references later.
Initial example categories:
    • Basic 1
    • Basic 5
    • Cuddle Position
    • Shadow
    • Sensual
    • Turn
    • Transition
    • Other
The category system must be user-customisable.
The user should be able to:
    • Create a category
    • Rename a category
    • Delete a category
    • Assign a segment to a category
System/default categories should be distinguishable from user-created categories.
The system must always provide a `Misc` category. It cannot be deleted, and
segments that have not yet received a more specific category must be assigned
to `Misc` before they are saved.
When a user deletes a custom category, its segments must be reassigned to
`Misc` rather than becoming uncategorized.
Suggested categories table:
id
user_id nullable
name
system_category
created_at
updated_at
A NULL user_id can represent a system category available to all users.
A populated user_id represents a user's custom category.

10. AI Analysis — MVP
The expected videos are primarily instructor demonstrations where the instructor verbally counts the movement.
Example:
    "And 5, 6, 7, 8..."
followed by the demonstration.
Therefore the MVP should use speech recognition and timestamped count detection.
Do NOT attempt to make the AI understand the actual dance movement.
The objective is:
    Find approximately where the instructor's spoken counts occur and use them to generate candidate 8-count segments.
The user will correct the boundaries when necessary.

11. Speech Recognition
Use a speech-to-text provider that can return timestamped words.
Recommended MVP
Start with Whisper or an equivalent timestamped speech-recognition service.
Create an abstraction:
interface SpeechRecognitionProvider {
  transcribe(
    audio: AudioInput
  ): Promise<TranscriptResult>;
}
Do not hard-code the rest of the application to a specific speech provider.
The provider should return approximately:
interface TranscriptWord {
  word: string;
  startTime: number;
  endTime: number;
  confidence?: number;
}
Example:
"and"   00:14.1
"1"     00:14.6
"2"     00:15.0
"3"     00:15.4
"4"     00:15.8
"5"     00:16.2
"6"     00:16.6
"7"     00:17.0
"8"     00:17.4

12. Count Detection
Do not use a large language model to determine the count boundaries.
Create a deterministic count-detection layer that processes the timestamped transcript.
It should recognise patterns such as:
1 2 3 4 5 6 7 8
5 6 7 8
and 1 2 3 4
1 2 3 4
5 6 7 8
The detector should tolerate:
    • Filler words
    • "And"
    • Short pauses
    • Slightly irregular timing
    • Missing numbers
    • Incorrectly transcribed numbers
    • Repeated counts
Output:
interface DetectedCount {
  count: number;
  timestamp: number;
  confidence: number;
}
Example:
1 → 14.6s
2 → 15.0s
3 → 15.4s
4 → 15.8s
5 → 16.2s
6 → 16.6s
7 → 17.0s
8 → 17.4s

13. Candidate Segment Generation
Detected counts are anchors, not necessarily exact movement boundaries.
For example:
1     2     3     4     5     6     7     8
│     │     │     │     │     │     │     │
14.6  15.0  15.4  15.8  16.2  16.6  17.0  17.4
The system should create a candidate segment such as:
8-count #1
Suggested start: 14.4s
Suggested end:   17.6s
Confidence:      91%
The offset around the detected counts should be configurable so it can be adjusted during testing.
The AI is providing a useful starting point, not a definitive answer.

14. AI Analysis Architecture
Keep the AI processing behind a provider abstraction.
Create:
interface VideoAnalysisProvider {
    analyzeAudio(
        input: AudioInput
  ): Promise<VideoAnalysisResult>;
}
The analysis pipeline should conceptually be:
Video
  ↓
Local audio extraction
  ↓
Speech recognition
  ↓
Timestamped transcript
  ↓
Count detection
  ↓
Candidate segment generation
  ↓
User review
The application should not depend directly on Whisper or another specific provider outside the provider implementation.

15. AI Analysis Jobs
Create a video_analysis_jobs table.
Suggested fields:
id
user_id
video_upload_id
provider
provider_model
analysis_version
status
progress
error_message
result_json
created_at
started_at
completed_at
Status values:
QUEUED
PROCESSING
COMPLETED
FAILED
CANCELLED
The client creates an idempotent job and invokes a Supabase Edge Function to
start processing. The Edge Function is responsible for authorization, job
creation, status transitions, and calling the configured processing provider.
If audio extraction or speech recognition needs native/Python dependencies that
do not fit Edge Functions, the Edge Function should hand the job to a small
dedicated worker. Do not make the mobile app responsible for keeping a job alive
while it is backgrounded.

The job must define retry, timeout, cancellation, and duplicate-request rules.
The recommended MVP behavior is one active job per video and analysis version;
re-analysis is explicit and creates a new versioned result. Keep candidate
segments inside the job's versioned result until the user accepts them. Only
accepted or manually created segments become rows in `segments`, so failed or
abandoned analysis cannot overwrite the user's work.

16. User Review and Segment Editing
After AI analysis, show the candidate segments.
Example:
Detected 8-counts
1–8
00:14.4 → 00:17.6
[Preview]
9–16
00:17.6 → 00:21.1
[Preview]
17–24
00:21.1 → 00:24.8
[Preview]
The user must be able to:
    • Accept all
    • Edit start time
    • Edit end time
    • Split a segment
    • Merge segments
    • Delete a segment
    • Add a segment manually
Editing should be quick and visual.
The user should not need to understand how the AI arrived at the result.
The final saved segment is controlled by the user.
Store whether a segment was:
AI generated
AI generated + user edited
Manually created
Every saved segment must have a category, defaulting to `Misc` when the user
does not choose a more specific category.

17. Metadata Persistence
For the current MVP, Supabase is the single authoritative store for application
metadata:
    • Video references
    • Segments
    • Categories
    • User corrections and notes
The device media library remains authoritative for the original video file and
the app keeps its resolved URI in runtime state for playback. Persistent SQLite
metadata is not required for the MVP.

Playback still works whenever the source video is available on the device, but
creating or editing metadata requires an authenticated network connection. If
offline metadata editing becomes a product requirement, revisit a SQLite cache
or local-first outbox as a separate architecture phase with explicit conflict
resolution and account-isolation rules.

18. Supabase
Use the existing Supabase project.
Supabase stores:
    • Video metadata and local media references
    • Segment metadata
    • Categories
    • Tags if implemented
    • AI analysis job state
    • User-specific application data
Do NOT use Supabase Storage for the original video.
Every user-owned table must be associated with the authenticated Supabase user through user_id, either directly or through a protected relationship.

19. Security
Enable Supabase Row Level Security on all user-owned data.
Users must only be able to access their own:
    • Videos
    • Segments
    • Categories
    • Analysis jobs
    • Other personal data
Do not rely solely on frontend filtering for security.
Supabase RLS must enforce ownership.

20. AI Cost and Privacy
The MVP should minimise AI costs and avoid unnecessary data transmission.
Do not upload the original video to an AI service.
Preferred processing flow:
User's phone
     ↓
Local video
     ↓
Extract audio locally
     ↓
Temporary audio upload for analysis
     ↓
Timestamped transcript
     ↓
Count detection
     ↓
Candidate segments
     ↓
Save metadata
Only transmit the minimum data required for speech analysis.
Recommended MVP decision: extract a temporary, compressed audio file on the
device and send only that audio to the speech provider through an authorized
server-side boundary. Do not send the original video. The provider adapter must
define the accepted audio format, maximum duration/size, timeout, deletion
behavior, and whether provider-side retention is disabled.

Audio extraction is a native capability decision, not a responsibility of the
video-player abstraction. Evaluate an Expo-compatible native audio extraction
module or audio-extraction service during Phase 3. The recommended approach is
to send temporary audio through an authorized server-side boundary so provider
credentials and provider-specific APIs never reach the mobile app. If a service
can extract audio directly from a securely transferred temporary input, it may
do so, but the original video must still not be uploaded to Supabase Storage or
the speech provider. Do not add a large general-purpose backend before this
technical spike is complete.
If audio is sent to a third-party speech service, the application's privacy documentation must clearly state that this may occur.
The original video should remain on the user's device.
The same video should not be repeatedly analysed unless the user explicitly requests re-analysis.
Actual provider pricing should be checked before implementation/launch because API pricing changes over time.

21. Recommended MVP Technologies
Mobile application
Existing:
Expo + React Native
Keep the existing stack.
Video
Start with:
expo-video
Use another Expo-compatible/native video solution only if the required timestamp and playback controls cannot be implemented reliably.
Local media
Use the appropriate Expo media/file APIs, such as:
    • expo-image-picker
    • expo-media-library
    • expo-file-system
Choose the minimum APIs necessary for the required iOS and Android media-reference behaviour.
Because the design depends on re-resolving OS media identifiers, evaluate
expo-media-library (or an equivalent maintained native module) in addition to
the picker. The picker alone may return a temporary URI and is not sufficient
to guarantee durable identity or permission recovery.
Database
Existing:
Supabase / PostgreSQL
Keep.
Speech recognition
Start with:
Whisper
or an equivalent timestamped speech-to-text API if testing shows it performs better for instructor counting.
Keep it behind SpeechRecognitionProvider.
Backend
Use:
Supabase Edge Functions
where suitable for lightweight orchestration.
If audio processing requires a Python environment or native dependencies that are unsuitable for Edge Functions, use a small dedicated processing service.
Do not introduce a separate backend unless technically necessary.

Provider recommendation
Keep three replaceable interfaces:
    • LocalMediaProvider: pick, resolve, inspect, and replace local media
    • VideoPlayerProvider: play, seek, stop at an end time, and loop a range
    • VideoAnalysisProvider: extract/transcribe/analyse temporary audio and return metadata
The domain and database layers must depend on these interfaces, not directly on
expo-video, a specific media-library package, Whisper, or a worker vendor.

22. Future Cross-Device Recovery
Cross-device media recovery is planned but deferred after the initial MVP.
It should add:
    • Fingerprint generation and versioning
    • Media-library scanning and matching adapters for iOS and Android
    • Match confidence scoring
    • A confirmation UI for proposed matches
    • Manual replacement for unresolved videos
    • Optional metadata export/import as a fallback

Supabase can restore the structured knowledge, but it cannot restore the source
video under the no-hosting rule. iCloud Photos, Google Photos, or another user
media provider may restore the file to the new device, after which the app can
attempt matching. Provider-specific identifiers must not be assumed to be
stable across devices.

23. MVP Development Phases
Phase 1 — Media Foundation
Implement:
    • Native video picker
    • `video_uploads` record backed by an OS media identifier
    • Media permissions
    • Local video playback
    • Missing video state
    • Replacement video
    • Segment playback
Success criterion
A user can select a video from their device and play arbitrary timestamp ranges without uploading the original video.

Phase 2 — Videos and Segments
Implement:
    • Add video
    • Video/session name and dance style
    • Local `video_uploads` references
    • Segment data model
    • Segment timeline
    • Segment editing
    • Categories
    • User-customisable categories
Success criterion
A user can take one class video and turn it into a collection of timestamped, categorised movement references.

Phase 3 — AI Count Detection
Implement:
    • Audio extraction
    • Speech recognition
    • Timestamped transcript
    • Count detection
    • Candidate 8-count generation
    • Confidence scores
    • AI analysis jobs
    • Saving analysis results
Success criterion
A typical instructor-counted dance video produces useful candidate 8-count boundaries that the user can quickly correct.

Phase 4 — Segment Library
Implement:
    • Browse saved segments
    • Filter by category
    • Search if already supported by the existing application
    • Play individual segments
    • Loop segments
    • Playback speed
Success criterion
A dancer can quickly find and replay a specific movement without searching through the entire original class video.

24. Explicitly Out of Scope for This MVP
Do NOT build:
    • Video hosting
    • Cloud copies of source videos
    • Video sharing
    • Social feed
    • Creator marketplace
    • Online dance content catalogue
    • Music/beat-based segmentation
    • Pose/movement recognition
    • Complex AI choreography recognition
    • Advanced dance analysis
    • Instructor accounts
    • Community features
    • Complex gamification
    • Cross-device video synchronisation
    • Sophisticated spaced-repetition algorithms
    • Advanced recommendation systems
The MVP is about:
    Turning a dancer's existing class video into a structured, searchable collection of useful movement segments.

25. MVP North Star
A dancer leaves a class with a 3-minute demonstration video on their phone.
They open the app.
They select the video.
The app analyses the instructor's spoken counts.
The app proposes:
1–8
9–16
17–24
25–32
33–40
41–48
The dancer quickly corrects any boundaries.
They categorise the useful sections:
Basic 1
Cuddle Position
Shadow
Turn
The application saves those segments as timestamp references to the original video.
Later, the dancer opens the app and can immediately access:
    Cuddle Position
and watch only that section of the original video.
The dancer's phone retains the actual video.
Supabase retains the structured knowledge about the video.

26. Core Architectural Principle
The application should maintain this separation:
USER'S DEVICE
    │
    └── Original Video
             │
             ▼
    Video Record
             │
             ▼
       AI Analysis
             │
             ▼
       Timestamped Segments
             │
             ▼
          Categories
             │
             ▼
        User's Library
The source video is media.
The Supabase data is structure and metadata.
The AI provides candidate timestamps.
The user provides the final correction and categorisation.
Do not allow the choice of speech-recognition provider, video player, or media-picker implementation to become tightly coupled to the rest of the application.
The MVP should prioritise:
    1. Reliable local video access
    2. Accurate timestamp references
    3. Useful rough count detection
    4. Fast segment correction
    5. Simple categorisation
    6. Secure Supabase storage of metadata
The objective is not perfect AI.
The objective is to reduce the time required for a dancer to turn a long class video into a useful personal movement library.
