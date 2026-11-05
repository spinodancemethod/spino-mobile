// Tiny one-shot flag shared between the dashboard tab bar / app entry and the Your Roadmaps
// screen. Pushing the default roadmap directly from a tabPress listener races the tab
// navigation (the parent Stack "navigates" to the dashboard route and pops anything above
// it), so instead the list screen opens the starred roadmap itself when it gains focus with
// this flag set. Returning via Back does not set the flag, so the list stays usable.
let pending = false

export function requestOpenDefaultRoadmap() {
    pending = true
}

/** Returns true once per request, then clears the flag. */
export function consumeOpenDefaultRoadmap(): boolean {
    const value = pending
    pending = false
    return value
}
