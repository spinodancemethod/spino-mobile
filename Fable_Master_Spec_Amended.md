# Fable --- Bachata Automatic Position Detection & Snippet Generation

## Complete Project Specification and Development Plan

## 1. Project overview

I want to add an automatic position-detection and snippet-generation
feature to my existing dance-video application.

The application already supports video uploading, video playback,
clipping, timestamp storage and displaying clips. The new feature should
build on this existing functionality rather than creating a separate
application or unnecessarily duplicating existing systems.

The goal is to upload a Bachata demo video and have the application
automatically:

1.  Analyse the audio and identify the musical 8-count rhythm.
2.  Identify the beginning of each 8-count cycle (count 1).
3.  Examine the video around those moments.
4.  Identify the dancers' starting position using a predefined library
    of positions.
5.  Detect when the starting position changes.
6.  Generate timestamped snippets grouping consecutive cycles with the
    same starting position.
7.  Display the resulting snippets in the existing application for
    playback and manual correction.

**The most important development principle is to prove that the feature
works reliably on one video before investing in scalability or
batch-processing infrastructure.**

This project has two distinct phases:

-   **Phase 1: Build and validate a successful single-video processing
    workflow.**
-   **Phase 2: Make the validated feature production-ready and capable
    of processing approximately 100 videos.**

Do not confuse these two objectives or attempt to build both
simultaneously.

------------------------------------------------------------------------

# 2. Critical development priorities

These requirements take precedence over implementation convenience.

### Priority 1 --- Make the feature work

The first objective is a complete, working end-to-end process on one
real Bachata video.

The system must demonstrate that it can correctly identify the 8-count
rhythm, recognise the dancers' starting positions, detect position
changes and generate useful snippets with accurate timestamps.

### Priority 2 --- Validate that it works consistently

Once it works on one video, test it on approximately 2--4 additional
representative videos.

This is important because a solution that works on one video may simply
be overfitted to its audio, camera angle, dancers or recording
conditions.

### Priority 3 --- Improve accuracy and reliability

Identify weaknesses and improve the approach before committing to the
production implementation.

### Priority 4 --- Scale the validated solution

Only after the single-video workflow has been demonstrated to work
should development move towards processing approximately 100 videos,
batch management, background queues, concurrency and production
infrastructure.

**Do not build elaborate scalability infrastructure for an AI detection
process that has not yet been proven to work.**

------------------------------------------------------------------------

# 3. Functional requirements

## 3.1 Video input

The feature should use the existing application's video upload and
storage functionality.

The initial implementation should work with one uploaded Bachata demo
video.

The video may contain:

-   Music without spoken counting.
-   Spoken counting without clearly audible music.
-   Music with spoken counting.
-   Different tempos and recording conditions.

The system should not assume that every video has the same audio
characteristics.

It should use the most appropriate available information to identify the
musical 8-count.

## 3.2 Musical rhythm and 8-count detection

The system needs to identify the musical beat grid and determine where
count 1 occurs in each 8-count cycle.

This is an important distinction:

-   Detecting BPM tells us the approximate speed of the music.
-   Detecting beats establishes the timing of individual beats.
-   Establishing the 8-count phase determines which beat corresponds to
    count 1.

Knowing the BPM alone is not sufficient.

The system should investigate appropriate techniques for:

-   Beat detection.
-   Downbeat detection.
-   Musical rhythm analysis.
-   Spoken-count recognition.
-   Audio analysis when music and spoken counting are both present.

The system should determine whether spoken counting can improve or
correct the musical rhythm detection.

The initial implementation must focus on Bachata's 8-count cycle.

It should also consider that a video may start partway through a song or
musical phrase, so the first beat in the recording cannot automatically
be assumed to be count 1.

If automatic count-1 identification is uncertain, the system should
expose this uncertainty rather than silently generating incorrectly
aligned snippets.

If necessary, investigate whether a simple manual correction mechanism
for the initial count-1 position would provide a reliable fallback.

## 3.3 Identifying count-1 moments

Once the rhythm and count-1 phase have been established, the system
should generate timestamps for each count-1 boundary.

These timestamps will determine when the system examines the dancers'
starting positions.

The system should investigate the best frame-selection strategy.

For example:

-   Examine a frame immediately before count 1.
-   Examine a frame at count 1.
-   Examine one or more frames immediately after count 1.
-   Compare several nearby frames to identify the most representative
    starting position.

Do not assume that a single frame at the exact musical boundary will
always be sufficient.

The correct approach should be established through testing with real
Bachata videos.

The aim is to identify the dancers' position at the beginning of each
8-count cycle, not to analyse their movements throughout the cycle.

## 3.4 Starting-position recognition

The initial feature should recognise only the dancers' starting
positions.

The application will have a predefined position library containing the
permitted position names.

An initial example might include:

-   Basic
-   Cuddle
-   Shadow
-   Misc

These are examples of the controlled vocabulary. The final library and
its definitions will be provided separately.

I will eventually provide reference images and descriptions to help the
system distinguish between positions.

The recognition system must:

-   Use only the approved position labels.
-   Compare the video frames against the supplied position definitions
    and reference images.
-   Avoid inventing new position names.
-   Return a confidence score or another meaningful indication of
    uncertainty.
-   Flag uncertain classifications for manual review.
-   Use Misc or needs_review when a reliable classification cannot be
    made.

The AI should not force every frame into a specific position when it is
uncertain.

### Scope limitations

The first version must not attempt to recognise:

-   Head rolls.
-   Body rolls.
-   Footwork.
-   Individual steps.
-   Dance technique.
-   Styling.
-   Choreography.
-   General dance movements.

These may be future features, but they are explicitly outside the scope
of this project.

The initial objective is simply to identify the dancers' starting
position at count 1.

## 3.5 Detecting position changes

The system should compare the identified position at each count-1
boundary with the previously detected position.

For example:

  8-count cycle   Detected position
  --------------- -------------------
  1               Basic
  2               Basic
  3               Basic
  4               Cuddle
  5               Cuddle
  6               Shadow

The system should recognise that the dancers remain in Basic for the
first three cycles, change to Cuddle for the next two, and then change
to Shadow.

A position change should not automatically be triggered by a single
uncertain or inconsistent classification.

The detection process should consider confidence and consistency to
reduce false position changes.

The system should investigate whether consecutive observations,
confidence thresholds or other techniques can improve change detection.

It should also consider the possibility that the dancers begin
transitioning into a new position before the next count-1 boundary.

The exact snippet boundary rules should be tested and documented.

## 3.6 Automatic snippet generation

Consecutive 8-count cycles with the same starting position should be
grouped into a single continuous snippet.

Using the previous example, the expected output is:

  Snippet   Position   Cycles included
  --------- ---------- -----------------
  1         Basic      1--3
  2         Cuddle     4--5
  3         Shadow     6

Each snippet should have:

-   A position label.
-   A start timestamp.
-   An end timestamp.
-   A reference to the original video.
-   Its associated 8-count cycles.
-   The AI's confidence or review status.

The snippets should be continuous and non-overlapping by default.

The intention is to reuse the existing timestamp-based clipping
functionality.

**Do not render and store separate physical video files unless the
existing architecture or a demonstrated technical requirement makes that
necessary.**

The preferred approach is to retain the original video and store the
snippet's start and end timestamps.

The application should then play the appropriate section of the original
video.

### Important timing consideration

The exact start and end boundaries need to be validated.

A position may begin changing slightly before the count-1 boundary at
which the new position is identified.

The proof of concept should investigate whether snippets should begin:

-   Exactly at the count-1 boundary.
-   Slightly before that boundary.
-   At the actual visible beginning of the new position transition.

The most useful approach should be selected based on real video playback
and review.

Do not assume that the musical boundary and the visible position-change
boundary are always identical.

------------------------------------------------------------------------

# 4. Position library and reference images

The system needs a controlled position library.

Each position should eventually have:

-   A unique identifier.
-   A position name.
-   A description.
-   One or more reference images.
-   Any useful distinguishing characteristics.
-   An active/inactive status if needed.

I will provide the actual position definitions and reference images.

The system should be designed so that positions can be added or modified
later without rewriting the detection pipeline.

The AI must always return a position from the approved library or an
uncertainty/fallback result.

It must not generate its own position categories.

The proof of concept can begin with a small number of positions.

------------------------------------------------------------------------

# 5. Phase 1 --- Build and validate the single-video feature

This is the primary development objective.

Do not begin by building a system for processing 100 videos.

The first objective is to successfully process one real video from
beginning to end.

## 5.1 Initial project inspection

Before making changes, inspect the existing application thoroughly.

Understand:

-   Frontend architecture.
-   Backend architecture.
-   Video upload process.
-   Video storage.
-   Video playback.
-   Existing clipping functionality.
-   Existing timestamp storage.
-   Database structure.
-   Authentication and permissions.
-   Existing APIs.
-   Any background-processing functionality already present.

Identify which existing components can be reused.

Avoid creating duplicate video storage, clip models, upload processes or
other infrastructure unnecessarily.

Do not modify the application during the initial inspection.

## 5.2 Technical research

Research the best technologies and approaches for the feature.

The research should cover:

**Audio and music analysis** - Beat detection. - Downbeat detection. -
BPM estimation. - 8-count phase identification. - Spoken-count
recognition. - Music and speech combined analysis.

**Video processing** - Video decoding. - Frame extraction. - Timestamp
accuracy. - Sampling multiple frames around count-1 boundaries. - FFmpeg
and suitable alternatives.

**Visual position recognition** - Vision models. - Image comparison. -
Reference-image matching. - Image embeddings. - Pose estimation where
useful. - Hybrid approaches combining different methods.

**Processing architecture** - Whether processing should happen locally
or on a server. - Suitable background-processing options. - Existing
infrastructure that can be reused. - Appropriate AI providers and APIs.

Compare the available options based on:

-   Accuracy.
-   Reliability.
-   Cost.
-   Processing time.
-   Complexity.
-   API limitations.
-   Scalability.
-   Vendor lock-in.
-   Ease of replacing individual components.

Do not automatically assume that a general-purpose vision model will
reliably distinguish Bachata starting positions.

The visual recognition approach must be tested against the actual
reference images and real videos.

Provide a recommendation with supporting reasoning.

Do not implement the production system during this research stage.

## 5.3 Design the proof of concept

Design a minimal proof of concept that demonstrates the entire process
on one video.

The proof of concept should avoid unnecessary production infrastructure.

It should demonstrate:

1.  Video input.
2.  Audio extraction and analysis.
3.  Beat and 8-count detection.
4.  Count-1 timestamp generation.
5.  Frame extraction around count-1.
6.  Position classification using the supplied reference images.
7.  Position-change detection.
8.  Snippet timestamp generation.
9.  Display of the generated results.
10. Playback and manual inspection.

The proof of concept should preserve intermediate results.

I need to be able to inspect:

-   The detected BPM.
-   The detected beat grid.
-   The proposed count-1 timestamps.
-   The frames selected for classification.
-   The predicted position at each count-1 boundary.
-   The confidence for each prediction.
-   Detected position changes.
-   Final snippet start and end timestamps.

Where practical, provide a simple debugging interface or report that
makes these results easy to review.

The objective is to understand not only whether the final snippets look
correct, but also where errors occur.

## 5.4 Test with one representative video

Start with one real Bachata demo video.

Do not begin with a batch of 100 videos.

The first video should be representative of the kind of content the
application will normally process.

Use the reference images and position definitions I provide.

Process the video from beginning to end.

Generate the snippets and make them available for playback and
inspection.

If the process fails, investigate why and improve it.

Do not simply report that the code ran successfully. The result must be
visually and musically useful.

## 5.5 Validate with additional videos

Once the first video works, test with approximately 2--4 additional
videos.

Where possible, use different examples:

-   Different dancers.
-   Different camera angles.
-   Different tempos.
-   Different starting positions.
-   Different audio conditions.
-   Videos with music only and videos with spoken counting.

The purpose is to establish whether the approach works generally rather
than only on one particular recording.

------------------------------------------------------------------------

# 6. Phase 1 evaluation and approval checkpoint

This is a mandatory checkpoint.

Before moving into production development, critically evaluate the proof
of concept.

Assess:

### Rhythm detection

-   Was the BPM detected correctly?
-   Was the beat grid accurate?
-   Was the 8-count phase correct?
-   Were count-1 timestamps aligned correctly?
-   Did music-only and spoken-count examples work?

### Frame selection

-   Were the selected frames useful?
-   Were the dancers visible?
-   Did the selected frames represent their starting positions?
-   Would multiple frames improve recognition?

### Position recognition

-   Were the positions classified correctly?
-   Were similar positions confused?
-   Did the system use only approved labels?
-   Were uncertain classifications handled appropriately?

### Position-change detection

-   Were genuine position changes identified?
-   Were false changes introduced?
-   Were any changes missed?
-   Were snippets grouped correctly?

### Snippet quality

-   Were start and end timestamps accurate?
-   Did the snippets include the useful parts of the demonstration?
-   Were there unwanted gaps or overlaps?
-   Did the snippets play correctly in the existing application?

### Overall assessment

Provide a clear report showing:

-   What worked.
-   What did not work.
-   Known limitations.
-   Accuracy measurements where meaningful.
-   Examples of successful and unsuccessful detections.
-   Estimated processing cost per video.
-   Recommended improvements.

Do not claim high accuracy without measured evidence.

If the approach is not reliable, recommend changes and test them.

**Do not proceed to the production implementation until I have reviewed
the results and approved moving forward.**

------------------------------------------------------------------------

# 7. Phase 1 production implementation --- Single-video workflow

Once the proof of concept has been validated and approved, implement the
feature properly within the existing application.

The first production milestone is still a successful single-video
workflow.

The user should be able to:

1.  Upload a Bachata demo video.
2.  Start the automatic analysis.
3.  See that processing is taking place.
4.  Wait for the analysis to complete.
5.  View the generated position snippets.
6.  Play each snippet.
7.  Correct position labels.
8.  Adjust snippet timestamps.
9.  Save the final results.

The implementation should integrate with the existing application rather
than creating a separate tool or workflow.

Heavy audio, video and AI processing should generally happen on a
backend or worker, not on the Expo mobile application.

However, reuse existing infrastructure wherever possible.

Do not introduce unnecessary services or complex infrastructure.

## 7.1 Processing results and data

The system should retain enough information to support review and
debugging.

For example:

-   Original video reference.
-   Audio analysis results.
-   Detected beat grid.
-   Count-1 timestamps.
-   Selected frame references.
-   AI position predictions.
-   Confidence scores.
-   Detected position changes.
-   Generated snippet timestamps.
-   Processing status.
-   Errors, where applicable.

The final database design should be based on the existing application's
architecture.

Avoid duplicating information unnecessarily.

## 7.2 Human corrections

Manual changes must be preserved.

The system should distinguish between:

-   Original AI prediction.
-   AI confidence.
-   Current displayed classification.
-   User-corrected classification.
-   Original AI-generated timestamps.
-   User-adjusted timestamps.

If the video is processed again, previously saved manual corrections
should not be silently overwritten.

The system should make it possible to identify which results have been
reviewed or manually corrected.

------------------------------------------------------------------------

# 8. Phase 2 --- Production hardening and scalability

This phase must not begin until Phase 1 has been successfully completed
and approved.

The purpose of this phase is to take the proven single-video processing
system and prepare it for processing approximately 100 videos.

Do not redesign the detection approach unnecessarily if it has already
been validated.

Focus on making the working system reliable, efficient and scalable.

## 8.1 Batch processing

The system should eventually support approximately 100 videos.

It should be able to:

-   Accept multiple videos.
-   Queue videos for processing.
-   Process videos in the background.
-   Control the number of simultaneous jobs.
-   Display processing progress.
-   Retry recoverable failures.
-   Continue processing if one video fails.
-   Prevent duplicate processing.
-   Allow completed videos to be reviewed independently.

One failed video must not stop the entire batch.

## 8.2 Processing statuses

Use clear processing statuses, such as:

-   Queued.
-   Processing.
-   Completed.
-   Failed.
-   Needs review.

The user should be able to see which videos have completed and which
need attention.

## 8.3 Performance and cost optimisation

Investigate ways to minimise unnecessary processing and API usage.

For example:

-   Upload each original video once.
-   Avoid sending entire videos to vision APIs when selected frames are
    sufficient.
-   Extract only the audio and frames required.
-   Cache intermediate results where appropriate.
-   Avoid repeating successful processing unnecessarily.
-   Use appropriate concurrency and API rate limits.
-   Monitor processing costs.

Provide realistic cost estimates for:

-   One video.
-   Five videos.
-   Approximately 100 videos.

Clearly state the assumptions behind the estimates, including video
duration, frame-sampling frequency, audio processing, AI model usage and
any storage or infrastructure costs.

## 8.4 Reliability

Implement appropriate:

-   Error handling.
-   Retry mechanisms.
-   Job recovery.
-   Processing timeouts.
-   Logging.
-   Monitoring.
-   Duplicate-job protection.
-   Data validation.

The system should be able to recover from interrupted processing without
unnecessarily starting every task again.

------------------------------------------------------------------------

# 9. User experience and review interface

The feature should fit naturally into the existing application.

The interface should make it easy to see the generated snippets and
check their accuracy.

The user should be able to:

-   View the list of generated snippets.
-   See each snippet's position label.
-   Play a snippet.
-   See its start and end timestamps.
-   Change the position.
-   Adjust its timestamps.
-   Delete an unwanted snippet.
-   Identify uncertain results.
-   Review processing status.

The interface should be practical and straightforward.

Do not spend excessive time on visual polish before the underlying
processing works.

The review interface is important because AI recognition will not always
be perfect.

Manual correction should be treated as a normal part of the workflow,
not an exceptional workaround.

------------------------------------------------------------------------

# 10. Architecture and future extensibility

The implementation should be designed so that individual technical
components can be improved or replaced.

For example:

-   The audio-analysis provider should be replaceable.
-   The beat and count-1 detection approach should be replaceable.
-   The visual recognition model should be replaceable.
-   The frame-extraction strategy should be configurable.
-   The position library should be extendable.

Avoid unnecessary vendor lock-in.

The system should retain useful intermediate data so that future
improvements can be tested without needing to repeat every stage of
processing.

Human corrections may eventually provide a useful labelled dataset for
improving recognition.

However, do not train a custom AI model as part of the initial project
unless research and proof-of-concept results demonstrate that it is
genuinely necessary.

## Future count recognition

The architecture should allow the possibility of extending the analysis
to other points in the 8-count, such as counts 3 and 4.

However, these are future capabilities only.

**Do not implement count 3 or count 4 recognition in this project.**

The first version is exclusively about starting-position recognition at
count 1.

------------------------------------------------------------------------

# 11. Testing and quality assurance

Testing should cover both the processing pipeline and the existing
application integration.

Test cases should include:

### Video and audio

-   Music only.
-   Spoken counting only.
-   Music and spoken counting together.
-   Different tempos.
-   Different video lengths.
-   Videos starting partway through a song.
-   Poor audio quality.

### Visual recognition

-   Different dancers.
-   Different camera angles.
-   Different lighting.
-   Similar-looking positions.
-   Partially obscured dancers.
-   Unclear or transitional positions.

### Snippet generation

-   No position changes.
-   One position change.
-   Multiple position changes.
-   Repeated positions.
-   Uncertain classifications.
-   Short and long position segments.

### Application integration

-   Video upload.
-   Processing progress.
-   Results display.
-   Snippet playback.
-   Timestamp editing.
-   Position correction.
-   Saving changes.
-   Reprocessing without losing manual corrections.

Testing should establish whether the system is genuinely useful, not
merely whether individual functions execute without errors.

------------------------------------------------------------------------

# 12. Required development workflow and task prompts

The following prompts should be carried out individually and in order.

Do not attempt to execute all stages simultaneously.

Each stage should end with a report explaining what was completed, what
was discovered, what decisions were made and what needs to happen next.

## Prompt 0 --- Understand the project

Read the entire specification.

Summarise the requirements in your own words.

Identify any ambiguities or missing information.

Do not inspect or modify code yet.

Confirm that you understand the two-phase development approach:

-   First prove the feature works on one video.
-   Then validate with additional videos.
-   Only afterwards build the scalable production system.

## Prompt 1 --- Inspect the existing application

Inspect the entire existing application and its architecture.

Identify:

-   Existing frontend and backend.
-   Video upload and storage.
-   Video playback.
-   Timestamp and clipping functionality.
-   Database models.
-   Existing APIs.
-   Existing background-processing capabilities.
-   Authentication and permissions.
-   Reusable components.

### Additional investigation --- Video storage and upload limitations

Investigate the existing video-storage architecture and identify whether
large video uploads can be supported without replacing the existing
backend.

Specifically:

-   Establish the current Supabase upload-size and storage limits that
    apply to the project.
-   Inspect whether the existing upload implementation and configuration
    can be improved.
-   Investigate resumable or chunked uploads where appropriate, while
    recognising that these do not bypass the storage provider's maximum
    individual file-size limits.
-   Assess whether dedicated external object storage, such as Cloudflare
    R2 or an equivalent service, could store large original video files
    while Supabase continues to handle authentication, database
    functionality, permissions and application metadata.
-   Compare the practical cost, complexity, reliability and integration
    effort of upgrading Supabase, retaining Supabase with external
    object storage, or replacing the backend.
-   Identify any implications for video playback, access control, signed
    URLs, upload progress and existing video references.

Do not assume that the entire backend needs replacing just because the
current storage tier has upload limitations. Recommend the smallest
change that solves the demonstrated problem.

Explain how the new feature should fit into the existing application.

Identify any technical limitations or risks.

Do not modify code.

## Prompt 2 --- Research the technical approach

Research the best available technologies for:

-   Bachata beat and 8-count detection.
-   Count-1 phase identification.
-   Spoken-count recognition.
-   Audio processing.
-   Video frame extraction.
-   Starting-position recognition.
-   Reference-image comparison.
-   Confidence and uncertainty handling.

Compare possible approaches and recommend the best one for the project.

Consider accuracy, cost, complexity, processing time, reliability and
replaceability.

Do not implement anything.

## Prompt 3 --- Design the minimal proof of concept

Design the simplest practical architecture capable of processing one
video from beginning to end.

Specify:

-   Processing steps.
-   Technologies.
-   Data flow.
-   Frame-selection strategy.
-   Classification approach.
-   Intermediate outputs.
-   How results will be reviewed.
-   How success will be measured.
-   The proposed video-upload and storage arrangement for the proof of
    concept.
-   Whether existing Supabase storage is sufficient for the selected
    test video or whether external object storage is needed.
-   How the application will securely upload, reference and retrieve the
    video if external storage is used.
-   The simplest way to keep Supabase responsible for existing
    authentication and database functionality wherever practical.

Make an explicit storage decision based on the actual test-video file
size, current provider limits, cost and implementation complexity.
Prefer retaining the existing backend and changing only the storage
component if that is sufficient.

Avoid production-scale infrastructure.

Do not implement the full production system.

Present the proposed proof of concept for review.

## Prompt 4 --- Build the single-video proof of concept

After approval, implement the proof of concept using one real Bachata
video and the supplied position reference images.

Demonstrate the complete process:

-   Audio analysis.
-   8-count detection.
-   Count-1 identification.
-   Frame extraction.
-   Position recognition.
-   Position-change detection.
-   Timestamped snippet generation.
-   Playback and review.

Expose intermediate results.

Do not build the 100-video batch-processing system.

Do not spend time on unnecessary production infrastructure.

## Prompt 5 --- Critically evaluate the proof of concept

Evaluate the actual results.

Identify incorrect rhythm detection, incorrect count-1 boundaries,
misclassified positions, missed position changes and inaccurate
snippets.

Explain what needs to improve.

If the approach is not sufficiently reliable, recommend alternatives and
test them.

Do not proceed automatically.

Wait for my review and approval.

## Prompt 6 --- Validate using additional videos

After the initial proof of concept is approved, test the approach on
approximately 2--4 additional real Bachata videos.

Assess whether it generalises across different videos and conditions.

Document the results and any necessary changes.

Obtain approval before moving into the production implementation.

## Prompt 7 --- Implement the single-video production workflow

Integrate the validated processing pipeline into the existing
application.

Implement the complete upload-to-results workflow.

Reuse existing application functionality.

Implement appropriate processing statuses, error handling and data
storage.

The target remains a reliable single-video workflow.

## Prompt 8 --- Implement the controlled position library

Implement the position library using the agreed position names,
descriptions and reference images.

Ensure that classifications use only approved labels.

Support uncertain classifications and manual review.

Make the library extendable.

## Prompt 9 --- Implement the review and correction interface

Integrate the generated snippets into the existing application.

Allow the user to play, edit, relabel and delete snippets.

Preserve original AI predictions and manual corrections.

Ensure that reprocessing does not silently overwrite human changes.

## Prompt 10 --- Production hardening

Review the complete single-video implementation.

Improve reliability, performance, error handling, logging, monitoring
and data integrity.

Confirm that the system is stable before moving to batch processing.

## Prompt 11 --- Implement batch processing and scalability

Only after the single-video system has been validated and approved,
implement the ability to process approximately 100 videos.

Add background queues, concurrency controls, progress tracking, retry
handling and duplicate-job protection as appropriate.

Optimise processing costs and infrastructure.

Do not compromise the accuracy of the validated detection process simply
to increase throughput.

## Prompt 12 --- Final testing and engineering review

Test the complete system.

Check:

-   Detection accuracy.
-   Timestamp accuracy.
-   Snippet quality.
-   Manual corrections.
-   Batch processing.
-   Failure recovery.
-   Performance.
-   Costs.
-   Security.
-   Existing application compatibility.

Document the architecture, setup, configuration, limitations and future
extension points.

Identify any remaining risks or improvements.

------------------------------------------------------------------------

# 13. Global rules for Fable throughout the project

These instructions apply to every stage.

### A. Do not rush into implementation

Understand the existing application first.

Do not make significant changes before explaining what will be changed
and why.

### B. Prioritise working results over code volume

The objective is a genuinely useful feature.

Writing large amounts of code does not count as success if the position
recognition or timestamps are inaccurate.

### C. Challenge the proposed approach when necessary

If there is a better technical solution, explain it and recommend it.

Do not follow the initial approach blindly.

### D. Do not over-engineer

Build only what is necessary for the current development stage.

In particular, avoid building batch infrastructure before proving
single-video processing.

### E. Keep the project maintainable

Reuse existing application functionality and follow its established
architecture.

Avoid unnecessary dependencies, duplicate systems and vendor lock-in.

### F. Preserve findings between stages

Maintain a clear record of:

-   Technical decisions.
-   Research findings.
-   Test results.
-   Known problems.
-   Outstanding questions.
-   Changes to the original plan.

Do not repeat completed research without a good reason.

### G. Ask before making important assumptions

If a decision materially affects accuracy, architecture, cost or the
user experience, ask me rather than silently making an assumption.

### H. Report honestly

Clearly distinguish between:

-   Implemented.
-   Tested successfully.
-   Partially working.
-   Not tested.
-   Known limitations.

Never describe a feature as working reliably without evidence.

### I. Obtain approval at the stage gates

Do not jump ahead from the proof of concept to production.

Do not start scalability work until I have approved the single-video
production workflow.

### J. Preserve the existing backend unless there is a compelling reason to replace it

Do not recommend replacing the entire backend simply because the current
video-storage solution has upload-size limitations.

Investigate whether the existing Supabase infrastructure can be retained
while using dedicated external object storage for large video files.

Keep authentication, database functionality and existing application
integrations wherever practical.

Any proposed infrastructure change must be justified by actual technical
requirements, cost and complexity.

Prioritise the smallest architectural change that solves the problem.

------------------------------------------------------------------------

# 14. Definition of success

## Phase 1 success

Phase 1 is successful when I can upload a real Bachata demo video into
my existing application and the system can:

1.  Identify the musical 8-count rhythm.
2.  Identify count-1 boundaries accurately enough for useful analysis.
3.  Examine the appropriate video frames.
4.  Identify the dancers' starting positions using the approved library.
5.  Detect meaningful position changes.
6.  Generate useful, timestamped snippets.
7.  Display and play the snippets in the existing application.
8.  Allow me to correct inaccurate classifications and timestamps.

The approach should also be validated against several additional videos
before production implementation.

## Phase 2 success

Phase 2 is successful when the validated feature can process
approximately 100 videos reliably, with suitable background processing,
progress tracking, error handling, recovery and cost control.

------------------------------------------------------------------------

# 15. Final instruction

The most important thing to understand about this project is that **the
AI recognition problem is the central challenge, not the
infrastructure.**

The difficult part is accurately identifying the musical count-1
boundaries and recognising the dancers' starting positions from video
frames.

The application already has video functionality that should be reused.

I do not want an elaborate system that can process 100 videos if it
cannot reliably identify positions.

I want a simple, accurate, working solution first.

**Prove it on one video. Validate it on several more. Build the
production workflow. Only then scale it to approximately 100 videos.**

That is the order in which this project must be developed.
