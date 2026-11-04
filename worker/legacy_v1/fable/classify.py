"""Step 05: position classification with Claude, voted per cycle.

Per frame: one call to the primary model with the library (cached), the full
frame, the upscaled hand crop and the pose summary. Per cycle: vote across the
frames plus the pose rule label. Split votes get one escalation call.
"""
from __future__ import annotations

import base64
import json
import time
from collections import Counter
from pathlib import Path

from .config import Config

BUCKET_W = {"high": 1.0, "medium": 0.7, "low": 0.4}

# Coarse body arrangement (first part of the user's three-part taxonomy). The
# classifier must commit to this before picking a position. Keyed by the
# arrangement id used in the output schema; value is what the model is told.
ARRANGEMENTS = {
    "facing": "partners face each other (front to front)",
    "same_direction": "both face the SAME direction, one directly in front of or alongside the other",
    "opposite_directions": "backs towards each other, facing OPPOSITE directions",
    "unclear": "cannot tell, dancers not both visible, or mid-transition",
}
# Which arrangement each active position belongs to, derived from the 'attribute'
# field in positions.json ("Facing | ...", "Shadow (Same Direction) | ...", etc.).
def _arrangement_of(position: dict) -> str:
    a = (position.get("attribute") or "").lower()
    if a.startswith("back-to-back"):
        return "opposite_directions"
    if a.startswith("shadow") or a.startswith("side-by-side"):
        return "same_direction"
    if a.startswith("facing"):
        return "facing"
    return "unclear"


def _b64(path: Path) -> str:
    return base64.standard_b64encode(path.read_bytes()).decode()


def _img(path: Path, media_type: str = "image/jpeg") -> dict:
    return {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": _b64(path)}}


def load_library(path: Path) -> dict:
    lib = json.loads(path.read_text())
    # Only active positions are offered to the classifier; inactive ones are
    # kept in the file so the vocabulary can grow without code changes.
    lib["all_positions"] = lib["positions"]
    lib["positions"] = [p for p in lib["positions"] if p.get("active", True)]
    lib["ids"] = [p["id"] for p in lib["positions"]] + [lib["fallback_id"]]
    return lib


def _schema(ids: list[str]) -> dict:
    # Field order matters: the model fills the JSON in order, so deciding the
    # body arrangement first forces the coarse question (facing? same direction?
    # opposite?) before the fine one. Prompt 5 found back-to-back seen side-on
    # being called 'shadow' when the hold was judged first.
    return {
        "type": "object",
        "properties": {
            "body_arrangement": {"type": "string", "enum": list(ARRANGEMENTS)},
            "position_id": {"type": "string", "enum": ids},
            "confidence_bucket": {"type": "string", "enum": ["high", "medium", "low"]},
            "evidence": {"type": "string"},
            "dancers_visible": {"type": "boolean"},
        },
        "required": ["body_arrangement", "position_id", "confidence_bucket", "evidence", "dancers_visible"],
        "additionalProperties": False,
    }


def _system_blocks(lib: dict, positions_dir: Path) -> list[dict]:
    lines = [
        "You classify the STARTING POSITION of two Bachata dancers at the beginning of an 8-count, from a video frame.",
        "",
        "Decide in two steps, and fill the JSON in this order:",
        "STEP 1 - body_arrangement. Look only at where the two torsos point:",
    ]
    for aid, desc in ARRANGEMENTS.items():
        lines.append(f"  - {aid}: {desc}")
    lines += [
        "  Back-to-back is NOT shadow: in back-to-back the dancers look in opposite directions and their backs touch; "
        "in shadow/side-by-side both look the same way. Seen from the side, back-to-back can look like one dancer behind the other, "
        "so check which way each FACE points before deciding.",
        "",
        "STEP 2 - position_id, chosen ONLY from the positions listed under the arrangement you picked. "
        "If none fits, or you picked 'unclear', answer 'unknown'. Never invent a position.",
        "",
    ]
    groups: dict[str, list[dict]] = {}
    for p in lib["positions"]:
        groups.setdefault(_arrangement_of(p), []).append(p)
    for aid in ARRANGEMENTS:
        if aid not in groups:
            continue
        lines.append(f"Positions when body_arrangement = {aid}:")
        for p in groups[aid]:
            cues = f" Cues: {'; '.join(p['cues'])}." if p.get("cues") else ""
            lines.append(f"- {p['id']}: {p['name']}. {p['description']}{cues}")
        lines.append("")
    lines += [
        f"- {lib['fallback_id']}: use when dancers are not both visible, are mid-transition, or the hold cannot be determined.",
        "(hammerlock can occur facing or side-by-side; pick it under either arrangement when an arm is folded behind a back.)",
        "",
        "You receive the full frame, and sometimes also a crop around the dancers' joined hands and a pose-estimation summary (which may be wrong; treat it as a hint).",
        "Pay particular attention to the hands: leader's left to follower's right with space between is 'basic'; both hands held with the arms crossed over each other is 'cross_hand'; only one hand joined is 'handshake'.",
        "Confidence buckets: high = unambiguous; medium = probable but a cue is unclear; low = guess.",
        "Respond with JSON only.",
    ]
    blocks: list[dict] = [{"type": "text", "text": "\n".join(lines)}]
    # Reference images, when supplied, go here so they sit inside the cached prefix.
    for p in lib["positions"]:
        for img in reference_images(p, positions_dir):
            blocks.append({"type": "text", "text": f"Reference image for {p['id']} ({p['name']}):"})
            blocks.append(_img_resized(img))
    blocks[-1]["cache_control"] = {"type": "ephemeral"}
    return blocks


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}  # iPhone HEIC must be converted to JPEG first
MAX_REFERENCE_IMAGES_PER_POSITION = 3  # keeps the cached prefix small; more adds cost, not accuracy


def reference_images(position: dict, positions_dir: Path) -> list[Path]:
    """Images listed in positions.json plus anything dropped into images/<id>/.

    The folder convention means the user only has to copy photos into the right
    sub-folder; no JSON edit is needed. Sorted by name so the order is stable
    (stable order keeps the prompt cache valid between runs).
    """
    found: list[Path] = []
    for rel in position.get("reference_images", []):
        p = positions_dir / rel
        if p.exists():
            found.append(p)
    folder = positions_dir / "images" / position["id"]
    if folder.is_dir():
        for p in sorted(folder.iterdir()):
            if p.suffix.lower() in IMAGE_SUFFIXES and not p.name.startswith(".") and p not in found:
                found.append(p)
    return found[:MAX_REFERENCE_IMAGES_PER_POSITION]


def _img_resized(path: Path, long_edge: int = 768) -> dict:
    """Phone photos are several MB; downscale and re-encode as JPEG before sending."""
    from io import BytesIO
    from PIL import Image, ImageOps

    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        im.thumbnail((long_edge, long_edge))
        buf = BytesIO()
        im.save(buf, format="JPEG", quality=85)
    data = base64.standard_b64encode(buf.getvalue()).decode()
    return {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": data}}


def _pose_summary(pose: dict) -> str:
    if pose.get("people", 0) < 2:
        return f"Pose: {pose.get('people', 0)} person detected."
    return (
        f"Pose: 2 people. Normalised hip distance {pose.get('hip_dist_norm')!s:.5}; "
        f"closest wrist pair {pose.get('wrist_pair')} (same-side hold: {pose.get('same_side_hold')}); "
        f"A faces camera: {pose['A'].get('facing_camera')}, B faces camera: {pose['B'].get('facing_camera')}; "
        f"rule guess {pose.get('rule_label')} ({pose.get('rule_confidence')})."
    )


def _cost(model: str, usage, cfg: Config) -> float:
    p = cfg.prices.get(model)
    if not p:
        return 0.0
    return (
        getattr(usage, "input_tokens", 0) * p["in"]
        + getattr(usage, "output_tokens", 0) * p["out"]
        + (getattr(usage, "cache_read_input_tokens", 0) or 0) * p["cache_read"]
        + (getattr(usage, "cache_creation_input_tokens", 0) or 0) * p["cache_write"]
    ) / 1e6


def _classify_frame(client, model: str, system: list[dict], ids: list[str], images: list[Path], pose_text: str, cfg: Config) -> dict:
    content = [_img(p) for p in images]
    content.append({"type": "text", "text": pose_text + "\nClassify the starting position."})
    t = time.time()
    resp = client.messages.create(
        model=model,
        max_tokens=1024,  # thinking tokens count against this; 300 was hit on some frames
        system=system,
        messages=[{"role": "user", "content": content}],
        # Low effort: this is a short perceptual judgement, not a reasoning task.
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": _schema(ids)}},
    )
    text = next((b.text for b in resp.content if b.type == "text"), "")
    try:
        data = json.loads(text) if text else {}
    except json.JSONDecodeError:
        data = {"evidence": f"unparseable: {text[:200]}"}
    if not text:
        data = {"evidence": f"no text block (stop_reason={resp.stop_reason})"}
    data.setdefault("body_arrangement", "unclear")
    data.setdefault("position_id", "unknown")
    data.setdefault("confidence_bucket", "low")
    data.setdefault("evidence", "")
    data.setdefault("dancers_visible", False)
    if data["confidence_bucket"] not in BUCKET_W:
        data["confidence_bucket"] = "low"
    if data["position_id"] not in ids:
        data["evidence"] = f"off-vocabulary '{data['position_id']}'; " + data["evidence"]
        data["position_id"] = "unknown"
    u = resp.usage
    data["_meta"] = {
        "model": model, "latency_s": round(time.time() - t, 2), "stop_reason": resp.stop_reason,
        "input_tokens": u.input_tokens, "output_tokens": u.output_tokens,
        "cache_read": getattr(u, "cache_read_input_tokens", 0), "cache_write": getattr(u, "cache_creation_input_tokens", 0),
        "cost_usd": round(_cost(model, u, cfg), 6),
    }
    return data


def vote(frame_labels: list[tuple[str, float]], rule: tuple[str, float] | None) -> tuple[str, float, dict]:
    """Weighted vote. Returns (label, agreement, tally). 'unknown' never wins outright
    unless it is the only label."""
    tally: Counter = Counter()
    for lab, w in frame_labels:
        tally[lab] += w
    if rule and rule[0] != "unknown":
        tally[rule[0]] += rule[1]
    if not tally:
        return "unknown", 0.0, {}
    total = sum(tally.values())
    known = {k: v for k, v in tally.items() if k != "unknown"}
    if not known:
        return "unknown", 1.0, dict(tally)
    label, score = max(known.items(), key=lambda kv: kv[1])
    return label, score / total, dict(tally)


def run(pose_result: dict, lib: dict, out_dir: Path, cfg: Config, positions_dir: Path) -> dict:
    import anthropic

    client = anthropic.Anthropic()
    system = _system_blocks(lib, positions_dir)
    ids = lib["ids"]
    def _one(cyc: dict) -> dict:
        total_cost = 0.0
        p0 = cyc["frames"][0].get("pose") if cyc["frames"] else None
        rule = (p0.get("rule_label", "unknown"), p0.get("rule_confidence", 0.0)) if p0 else None

        def classify_frames(frs: list[dict]) -> float:
            cost = 0.0
            if cfg.multi_frame_call and len(frs) > 1:
                # One call, all frames: "which hold are the dancers IN during this 8-count?"
                imgs = [Path(fr["api"]) for fr in frs]
                note = (f"These {len(imgs)} frames are taken in time order across ONE 8-count "
                        f"(offsets from count 1, in seconds: {', '.join('%.1f' % fr['offset'] for fr in frs)}). "
                        "Dancers may still be finishing a turn in the first frame. Name the hold they settle INTO "
                        "during this 8-count, not the transition.")
                r = _classify_frame(client, cfg.primary_model, system, ids, imgs, note, cfg)
                frame_results.append({**frs[0], "prediction": r, "strip": [fr["api"] for fr in frs]})
                return r["_meta"]["cost_usd"]
            for fr in frs:
                imgs = [Path(fr["api"])] + ([Path(fr["hand_crop"])] if fr.get("hand_crop") else [])
                r = _classify_frame(client, cfg.primary_model, system, ids, imgs,
                                    _pose_summary(fr["pose"]) if fr.get("pose") else "", cfg)
                cost += r["_meta"]["cost_usd"]
                frame_results.append({**fr, "prediction": r})
            return cost

        def tally_up() -> tuple[str, float, dict, bool]:
            labels = [(f["prediction"]["position_id"], BUCKET_W[f["prediction"]["confidence_bucket"]]) for f in frame_results]
            # Prompt 5: the pose rule is excluded from the vote by default. It was wrong on
            # most cycles and its 0.2-0.3 weight diluted agreement enough to trigger
            # escalations that then overruled correct frame majorities.
            label, agreement, tally = vote(labels, rule if cfg.rule_in_vote else None)
            # With a single frame the vote is trivially unanimous, so scale by the
            # model's own confidence bucket: one 'low' frame must not come out as 1.0
            # (the merge step relies on < 0.5 meaning "unclear, continue previous").
            if label != "unknown":
                agreement *= max(w for lab, w in labels if lab == label)
            # Strict majority of frames, counting only medium/high-confidence frames:
            # two 'low' guesses must not outvote one 'medium' frame without escalation.
            majority = sum(1 for lab, w in labels if lab == label and w >= BUCKET_W["medium"]) * 2 > len(labels)
            return label, agreement, tally, majority

        # Round 1: the frames at/just after count 1. Round 2 (extra offsets) only
        # when round 1 has no confident majority; cheaper than a Sonnet escalation.
        frame_results: list[dict] = []
        round1 = [fr for fr in cyc["frames"] if fr.get("round", 1) == 1]
        round2 = [fr for fr in cyc["frames"] if fr.get("round", 1) == 2]
        total_cost += classify_frames(round1)
        label, agreement, tally, majority = tally_up()
        used_round2 = False
        # Second frame only when the first answer is unknown or 'low' (< 0.6 after bucket scaling).
        if round2 and (label == "unknown" or agreement < 0.6):
            total_cost += classify_frames(round2)
            label, agreement, tally, majority = tally_up()
            used_round2 = True
        escalation = None
        if agreement < 0.75 and label != "unknown" and cfg.escalation_model and not (majority and cfg.trust_frame_majority):
            imgs = [Path(f["api"]) for f in frame_results][:3]
            esc = _classify_frame(client, cfg.escalation_model, system, ids, imgs,
                                  "These are frames around the same count-1. " + (_pose_summary(p0) if p0 else ""), cfg)
            total_cost += esc["_meta"]["cost_usd"]
            escalation = esc
            # Prompt 5 policy: the escalation can CONFIRM the vote, or OVERRIDE it when
            # highly confident. It never forces 'unknown': a low-confidence vote kept
            # and flagged for review is more useful than a hidden boundary (an
            # 'unknown' cycle silently merges into the previous snippet).
            if esc["position_id"] == label:
                agreement = max(agreement, 0.8)
            elif esc["confidence_bucket"] == "high" and esc["position_id"] != "unknown":
                label, agreement = esc["position_id"], 0.6
            # else: keep the vote label and its (low) agreement; needs_review will be set
        # (A frame majority with a dissenting frame keeps its label; needs_review
        # below still flags it when agreement < 0.75.)
        # Review only when unknown or below a 'medium' single-frame answer (0.7).
        needs_review = label == "unknown" or agreement < 0.6
        return {"index": cyc["index"], "count1_t": cyc["count1_t"], "count": cyc.get("count"),
                "whole_video": cyc.get("whole_video", False),
                "frames": frame_results, "rule": rule, "tally": tally, "used_round2": used_round2,
                "label": label, "confidence": round(agreement, 3), "needs_review": needs_review,
                "escalation": escalation, "_cost": total_cost}

    # Cycles are independent, so classify them in parallel. The Anthropic client is
    # thread-safe; the prompt cache is shared across threads.
    from concurrent.futures import ThreadPoolExecutor
    todo = pose_result["cycles"]
    cycles: list[dict] = []
    if todo:
        cycles.append(_one(todo[0]))  # first cycle alone so the prompt cache is written once, not N times
    with ThreadPoolExecutor(max_workers=max(1, cfg.classify_concurrency)) as ex:
        cycles += list(ex.map(_one, todo[1:]))
    total_cost = sum(c.pop("_cost") for c in cycles)
    return {"cycles": cycles, "total_cost_usd": round(total_cost, 5), "primary_model": cfg.primary_model}


def run_without_api(pose_result: dict) -> dict:
    """Offline mode: pose rule only. Lets the pipeline be exercised without a key."""
    cycles = []
    for cyc in pose_result["cycles"]:
        rule = (cyc["frames"][0]["pose"].get("rule_label", "unknown"), cyc["frames"][0]["pose"].get("rule_confidence", 0.0)) if cyc["frames"] else ("unknown", 0.0)
        cycles.append({"index": cyc["index"], "count1_t": cyc["count1_t"], "count": cyc.get("count"),
                       "whole_video": cyc.get("whole_video", False),
                       "frames": [{**f, "prediction": None} for f in cyc["frames"]], "rule": rule, "tally": {rule[0]: rule[1]},
                       "label": rule[0], "confidence": round(rule[1], 3), "needs_review": True, "escalation": None})
    return {"cycles": cycles, "total_cost_usd": 0.0, "primary_model": None, "note": "pose-rule only, no API"}
