"""Step 04: two-person pose features with RTMPose (rtmlib, ONNX CPU).

COCO-17 keypoints: 5/6 shoulders, 9/10 wrists, 11/12 hips (L/R anatomical).
The rule label here is one voter among several, never the final answer.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

from .config import Config

L_SHO, R_SHO, L_WRI, R_WRI, L_HIP, R_HIP = 5, 6, 9, 10, 11, 12
KP_MIN_SCORE = 0.3


def _person_feats(kp: np.ndarray, sc: np.ndarray) -> dict:
    def pt(i):
        return kp[i] if sc[i] >= KP_MIN_SCORE else None

    ls, rs, lh, rh = pt(L_SHO), pt(R_SHO), pt(L_HIP), pt(R_HIP)
    shoulder_w = float(np.linalg.norm(ls - rs)) if ls is not None and rs is not None else None
    torso_h = None
    if ls is not None and rs is not None and lh is not None and rh is not None:
        torso_h = float(np.linalg.norm((ls + rs) / 2 - (lh + rh) / 2))
    hip_c = (lh + rh) / 2 if lh is not None and rh is not None else None
    # Anatomical left shoulder appearing on image-right means facing the camera.
    facing_camera = None
    if ls is not None and rs is not None and shoulder_w and torso_h and shoulder_w > 0.25 * torso_h:
        facing_camera = bool(ls[0] > rs[0])
    return {
        "shoulder_w": shoulder_w, "torso_h": torso_h,
        "hip_center": hip_c.tolist() if hip_c is not None else None,
        "facing_camera": facing_camera,
        "l_wrist": pt(L_WRI).tolist() if pt(L_WRI) is not None else None,
        "r_wrist": pt(R_WRI).tolist() if pt(R_WRI) is not None else None,
        "mean_score": float(sc.mean()),
    }


def _pair_wrists(a: dict, b: dict) -> tuple[str | None, float | None]:
    best, label = None, None
    for an, ak in (("l", "l_wrist"), ("r", "r_wrist")):
        for bn, bk in (("l", "l_wrist"), ("r", "r_wrist")):
            if a[ak] is None or b[bk] is None:
                continue
            d = float(np.linalg.norm(np.array(a[ak]) - np.array(b[bk])))
            if best is None or d < best:
                best, label = d, f"A{an}-B{bn}"
    return label, best


def analyse_frame(img_path: Path, body) -> dict:
    import cv2

    img = cv2.imread(str(img_path))
    kps, scores = body(img)
    if kps is None or len(kps) == 0:
        return {"people": 0, "rule_label": "unknown", "rule_confidence": 0.0, "hand_box": None}
    # Keep the two largest skeletons by bounding-box area.
    areas = [(np.ptp(k[:, 0]) * np.ptp(k[:, 1]), i) for i, k in enumerate(kps)]
    idx = [i for _, i in sorted(areas, reverse=True)[:2]]
    people = [_person_feats(kps[i], scores[i]) for i in idx]
    out = {"people": len(people), "A": people[0], "B": people[1] if len(people) > 1 else None}
    if len(people) < 2:
        out.update(rule_label="unknown", rule_confidence=0.0, hand_box=None, note="fewer than 2 people")
        return out

    A, B = people
    scale = np.nanmean([x for x in (A["shoulder_w"], B["shoulder_w"]) if x]) if (A["shoulder_w"] or B["shoulder_w"]) else None
    hip_dist = None
    if A["hip_center"] and B["hip_center"] and scale:
        hip_dist = float(np.linalg.norm(np.array(A["hip_center"]) - np.array(B["hip_center"])) / scale)
    pair, pair_d = _pair_wrists(A, B)
    pair_norm = pair_d / scale if (pair_d is not None and scale) else None
    same_side = pair in ("Al-Bl", "Ar-Br") if pair else None

    # Soft rules. Thresholds are starting points for Prompt 5 tuning.
    label, conf = "unknown", 0.2
    both_face_known = A["facing_camera"] is not None and B["facing_camera"] is not None
    if both_face_known and A["facing_camera"] == B["facing_camera"] and (pair_norm is None or pair_norm > 1.5):
        label, conf = "shadow_back_to_back", 0.5
    elif hip_dist is not None and hip_dist < 1.0:
        label, conf = "basic_sensual", 0.5
    elif same_side is True and pair_norm is not None and pair_norm < 0.8:
        label, conf = "basic_left_over_right", 0.5
    elif hip_dist is not None:
        label, conf = "basic", 0.4
    conf *= float(np.clip((A["mean_score"] + B["mean_score"]) / 2, 0, 1))

    hand_box = None
    if pair and pair_d is not None and scale:
        an, bn = pair.split("-")
        pa = np.array(A["l_wrist" if an == "Al" else "r_wrist"])
        pb = np.array(B["l_wrist" if bn == "Bl" else "r_wrist"])
        c = (pa + pb) / 2
        half = max(1.2 * scale, pair_d) / 2 + 0.3 * scale
        hand_box = [float(c[0] - half), float(c[1] - half), float(c[0] + half), float(c[1] + half)]

    out.update(hip_dist_norm=hip_dist, wrist_pair=pair, wrist_pair_norm=pair_norm, same_side_hold=same_side,
               rule_label=label, rule_confidence=round(conf, 3), hand_box=hand_box)
    return out


def hand_crop(native: Path, box: list[float] | None, dst: Path, scale: float) -> Path:
    with Image.open(native) as im:
        w, h = im.size
        if box is None:
            box = [w / 3, h / 4, 2 * w / 3, 3 * h / 4]  # centre fallback
        x0, y0, x1, y1 = [int(round(v)) for v in box]
        x0, y0, x1, y1 = max(0, x0), max(0, y0), min(w, x1), min(h, y1)
        if x1 - x0 < 8 or y1 - y0 < 8:
            x0, y0, x1, y1 = int(w / 3), int(h / 4), int(2 * w / 3), int(3 * h / 4)
        crop = im.crop((x0, y0, x1, y1))
        crop = crop.resize((int(crop.width * scale), int(crop.height * scale)), Image.LANCZOS)
        crop.save(dst, quality=92)
    return dst


def run(frames: dict, out_dir: Path, cfg: Config) -> dict:
    from rtmlib import Body

    body = Body(mode="balanced", backend="onnxruntime", device="cpu")
    result = {"cycles": []}
    for cyc in frames["cycles"]:
        entries = []
        for fr in cyc["frames"]:
            feats = analyse_frame(Path(fr["native"]), body)
            crop = Path(fr["native"]).with_name(Path(fr["native"]).stem + "_hand.jpg")
            hand_crop(Path(fr["native"]), feats.get("hand_box"), crop, cfg.hand_crop_scale)
            entries.append({**fr, "pose": feats, "hand_crop": str(crop)})
        result["cycles"].append({**cyc, "frames": entries})
    return result
