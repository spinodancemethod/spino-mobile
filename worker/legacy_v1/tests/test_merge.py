from fable.classify import vote
from fable.merge import merge


def _c(i, label, conf=0.9, review=False, t=None):
    return {"index": i, "count1_t": t if t is not None else i * 4.0, "label": label, "confidence": conf, "needs_review": review}


def test_merge_groups_consecutive_cycles():
    cycles = [_c(0, "basic"), _c(1, "basic"), _c(2, "basic"), _c(3, "basic_sensual"), _c(4, "basic_sensual"), _c(5, "shadow_back_to_back")]
    s = merge(cycles, duration=30.0)
    assert [x["position_id"] for x in s] == ["basic", "basic_sensual", "shadow_back_to_back"]
    assert s[0]["start"] == 0.0 and s[0]["end"] == 12.0
    assert s[1]["start"] == 12.0 and s[1]["end"] == 20.0
    assert s[2]["end"] == 30.0


def test_merge_absorbs_isolated_unknown():
    cycles = [_c(0, "basic"), _c(1, "unknown", 0.2, True), _c(2, "basic")]
    s = merge(cycles, duration=12.0)
    assert len(s) == 1 and s[0]["absorbed"] == [1] and s[0]["needs_review"]


def test_merge_unknown_run_extends_previous_snippet():
    # The user's rule: unclear cycles continue the prior snippet, even several in a row,
    # and even when the next known label differs.
    cycles = [_c(0, "basic"), _c(1, "shadow_back_to_back"), _c(2, "unknown", 0.6, True),
              _c(3, "unknown", 0.5, True), _c(4, "unknown", 0.5, True), _c(5, "basic")]
    s = merge(cycles, duration=35.0)
    assert [x["position_id"] for x in s] == ["basic", "shadow_back_to_back", "basic"]
    assert s[1]["cycle_indices"] == [1, 2, 3, 4] and s[1]["absorbed"] == [2, 3, 4] and s[1]["needs_review"]
    assert s[2]["start"] == 20.0


def test_merge_leading_unknown_joins_first_known_snippet():
    cycles = [_c(0, "unknown", 0.3, True), _c(1, "basic"), _c(2, "basic")]
    s = merge(cycles, duration=12.0)
    assert len(s) == 1 and s[0]["position_id"] == "basic" and s[0]["absorbed"] == [0]


def test_merge_min_cycles_suppresses_blip():
    cycles = [_c(0, "basic"), _c(1, "basic"), _c(2, "basic_sensual"), _c(3, "basic"), _c(4, "basic")]
    assert len(merge(cycles, 20.0, min_cycles_to_switch=1)) == 3
    s = merge(cycles, 20.0, min_cycles_to_switch=2)
    assert len(s) == 1 and s[0]["absorbed"] == [2]


def test_merge_whole_video_fallback_is_low_confidence():
    s = merge([{**_c(0, "basic", 0.9), "whole_video": True}], duration=35.0)
    assert len(s) == 1 and s[0]["end"] == 35.0 and s[0]["confidence"] <= 0.1 and s[0]["needs_review"]


def test_lead_in_shifts_boundaries_but_not_below_zero():
    cycles = [_c(0, "basic"), _c(1, "basic_sensual")]
    s = merge(cycles, 8.0, lead_in_s=-0.25)
    assert s[0]["start"] == 0.0 and s[1]["start"] == 3.75


def test_vote_prefers_known_label_over_unknown():
    label, agreement, tally = vote([("unknown", 0.4), ("basic", 1.0), ("basic", 0.7)], ("basic", 0.4))
    assert label == "basic" and agreement > 0.75


def test_vote_split_has_low_agreement():
    label, agreement, _ = vote([("basic", 1.0), ("basic_left_over_right", 1.0), ("basic", 0.4)], None)
    assert label == "basic" and agreement < 0.75


def test_reference_images_discovered_from_folder(tmp_path):
    from PIL import Image
    from fable.classify import reference_images, _img_resized
    d = tmp_path / "images" / "basic"
    d.mkdir(parents=True)
    for name in ["b.jpg", "a.png", "notes.txt", ".DS_Store", "c.jpg", "d.jpg"]:
        p = d / name
        if p.suffix in {".jpg", ".png"}:
            Image.new("RGB", (2000, 1500)).save(p)
        else:
            p.write_text("x")
    imgs = reference_images({"id": "basic", "reference_images": []}, tmp_path)
    assert [p.name for p in imgs] == ["a.png", "b.jpg", "c.jpg"]  # sorted, capped at 3, non-images skipped
    block = _img_resized(imgs[0])
    assert block["source"]["media_type"] == "image/jpeg" and len(block["source"]["data"]) > 0


def test_low_confidence_cycle_cannot_start_a_snippet():
    # Bar-level scanning: count-5 frames of a travelling move give scattered
    # low-confidence labels; they must continue the previous snippet.
    cycles = [_c(0, "basic"), _c(1, "shadow", 0.3, True), _c(2, "shadow_back_to_back", 0.78),
              _c(3, "cross_hand", 0.42, True), _c(4, "cuddle")]
    s = merge(cycles, duration=20.0)
    assert [x["position_id"] for x in s] == ["basic", "shadow_back_to_back", "cuddle"]
    assert s[0]["absorbed"] == [1] and s[1]["absorbed"] == [3]
    # threshold is configurable
    assert len(merge(cycles, 20.0, min_confidence_to_switch=0.0)) == 5


def test_count5_boundary_needs_stronger_evidence():
    cycles = [{**_c(0, "basic"), "count": 1}, {**_c(1, "cross_hand", 0.6), "count": 5},
              {**_c(2, "cuddle", 0.6), "count": 1}, {**_c(3, "cuddle", 0.9), "count": 5}]
    s = merge(cycles, duration=16.0)
    # 0.6 is enough on count 1 but not on count 5
    assert [x["position_id"] for x in s] == ["basic", "cuddle"] and s[0]["absorbed"] == [1]
