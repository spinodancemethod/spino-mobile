"""Step 06: group consecutive cycles with the same label into snippets. Pure."""
from __future__ import annotations


def merge(cycles: list[dict], duration: float, min_cycles_to_switch: int = 1, lead_in_s: float = 0.0,
          min_confidence_to_switch: float = 0.5, min_confidence_to_switch_on5: float = 0.75) -> list[dict]:
    """cycles: [{index, count1_t, label, confidence, needs_review}] in time order.

    Rules:
    - A new label starts a new snippet only once it has persisted for
      `min_cycles_to_switch` consecutive cycles; shorter blips are absorbed
      into the current snippet and flagged.
    - An 'unknown' cycle between two cycles of the same label is absorbed
      and flagged, so a single uncertain classification never splits a snippet.
    - Snippet end = count-1 of the first cycle after it, or video end.
    """
    if not cycles:
        return []
    if len(cycles) == 1 and cycles[0].get("whole_video"):
        c = cycles[0]
        return [{"position_id": c["label"], "start": 0.0, "end": duration, "cycle_indices": [0],
                 "confidence": min(c["confidence"], 0.1), "needs_review": True, "absorbed": [],
                 "note": "no usable audio; whole video as one snippet"}]

    # Pass 1: an unknown cycle continues the preceding snippet (user rule, 2026-10-31:
    # "if the position is not clear, that cycle merges with the prior one"). Leading
    # unknowns, with nothing before them, take the first known label that follows.
    # A low-confidence label may not START a new snippet: when scanning every bar
    # (counts 1 and 5), count-5 frames of travelling moves produce scattered
    # low-confidence guesses that would fragment the video (Prompt 5, eval7).
    # Such cycles are treated as unknown and continue the preceding snippet.
    # Positions normally change on count 1, so a boundary on count 5 needs stronger
    # evidence (`min_confidence_to_switch_on5`) than one on count 1.
    def _thresh(c: dict) -> float:
        return min_confidence_to_switch_on5 if c.get("count") == 5 else min_confidence_to_switch
    labels = [c["label"] if c.get("confidence", 1.0) >= _thresh(c) else "unknown" for c in cycles]
    filled = labels[:]
    absorbed_unknown = set()
    for i in range(len(labels)):
        if filled[i] == "unknown" and i > 0 and filled[i - 1] != "unknown":
            filled[i] = filled[i - 1]
            absorbed_unknown.add(i)
    first_known = next((lab for lab in filled if lab != "unknown"), None)
    if first_known:
        for i in range(len(filled)):
            if filled[i] != "unknown":
                break
            filled[i] = first_known
            absorbed_unknown.add(i)

    # Pass 2: suppress runs shorter than min_cycles_to_switch (except at the start).
    runs: list[tuple[str, int, int]] = []  # (label, start_idx, end_idx_inclusive)
    s = 0
    for i in range(1, len(filled) + 1):
        if i == len(filled) or filled[i] != filled[s]:
            runs.append((filled[s], s, i - 1))
            s = i
    absorbed_blip = set()
    if min_cycles_to_switch > 1 and len(runs) > 1:
        merged: list[tuple[str, int, int]] = [runs[0]]
        for lab, a, b in runs[1:]:
            if b - a + 1 < min_cycles_to_switch:
                plab, pa, pb = merged[-1]
                merged[-1] = (plab, pa, b)
                absorbed_blip.update(range(a, b + 1))
            elif lab == merged[-1][0]:
                plab, pa, pb = merged[-1]
                merged[-1] = (plab, pa, b)
            else:
                merged.append((lab, a, b))
        runs = merged

    snippets = []
    for lab, a, b in runs:
        idxs = list(range(a, b + 1))
        start = max(0.0, cycles[a]["count1_t"] + lead_in_s)
        end = cycles[b + 1]["count1_t"] + lead_in_s if b + 1 < len(cycles) else duration
        conf = sum(cycles[i]["confidence"] for i in idxs if i not in absorbed_unknown and i not in absorbed_blip) / max(
            1, len([i for i in idxs if i not in absorbed_unknown and i not in absorbed_blip]))
        snippets.append({
            "position_id": lab, "start": round(start, 3), "end": round(end, 3), "cycle_indices": idxs,
            "confidence": round(conf, 3),
            "needs_review": lab == "unknown" or any(cycles[i]["needs_review"] for i in idxs),
            "absorbed": sorted(i for i in idxs if i in absorbed_unknown or i in absorbed_blip),
        })
    return snippets
