from fable.grid import build, chunks


def _phase(count1, cycle_len, transcript=None):
    return {"ok": True, "method": "spoken_counts", "count1_times": count1, "cycle_len_s": cycle_len,
            "confidence": 0.8, "asr": {"transcript": transcript or []}}


def test_counting_grid_has_8_beats_per_cycle_and_bars_every_4():
    g = build(_phase([0.0, 4.0, 8.0], 4.0), {"ok": False}, {"duration_s": 12.0})
    assert g["mode"] == "counting" and g["count_period_s"] == 0.5
    assert g["beat_times"][:9] == [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0]
    assert g["bar_times"] == [0.0, 2.0, 4.0, 6.0, 8.0, 10.0]
    assert len(g["beat_times"]) == 24


def test_counting_grid_does_not_invent_beats_across_a_pause():
    # cycle at 0 and 4, then the instructor talks until 20
    g = build(_phase([0.0, 4.0, 20.0], 4.0), {"ok": False}, {"duration_s": 24.0})
    gap_beats = [t for t in g["beat_times"] if 8.0 <= t < 20.0]
    assert gap_beats == []            # nothing between the end of cycle 2 and the restart
    assert 20.0 in g["beat_times"]


def test_speech_spans_from_non_digit_segments_merged():
    tr = [{"start": 0.0, "end": 4.0, "digit_density": 1.0},
          {"start": 5.0, "end": 7.0, "digit_density": 0.2},
          {"start": 7.3, "end": 9.0, "digit_density": 0.0},
          {"start": 12.0, "end": 13.0, "digit_density": 0.1}]
    g = build(_phase([0.0, 4.0], 4.0, tr), {"ok": False}, {"duration_s": 14.0})
    assert g["speech_spans"] == [[5.0, 9.0], [12.0, 13.0]]


def test_music_grid_marks_ambiguous_and_bars_from_downbeat_phase():
    beats = {"ok": True, "grid_beats": [0.5 * k for k in range(16)], "grid_index_start": 0,
             "downbeat_phase4": 1, "period_s": 0.5, "downbeat_margin": 0.8}
    g = build({"ok": True, "method": "downbeat_only"}, beats, {"duration_s": 8.0})
    assert g["mode"] == "music" and g["ambiguous_1_vs_5"]
    assert g["bar_times"] == [0.5, 2.5, 4.5, 6.5] and g["count1_times"] == [0.5, 4.5]


def test_no_audio_grid_is_empty():
    g = build({"ok": False, "method": "no_audio"}, {"ok": False}, {"duration_s": 10.0})
    assert g["mode"] == "none" and g["beat_times"] == []


def test_chunks_of_8_align_to_count1_and_4_split_them():
    g = build(_phase([0.0, 4.0, 8.0], 4.0), {"ok": False}, {"duration_s": 12.0})
    c8 = chunks(g, 8)
    assert [(c["start"], c["end"]) for c in c8] == [(0.0, 4.0), (4.0, 8.0), (8.0, 12.0)]
    assert all(c["count_label"] == 1 for c in c8)
    c4 = chunks(g, 4)
    assert [(c["start"], c["end"]) for c in c4][:3] == [(0.0, 2.0), (2.0, 4.0), (4.0, 6.0)]
    assert [c["count_label"] for c in c4][:2] == [1, None]


def test_music_chunks_align_to_bars_with_unlabelled_lead_in():
    beats = {"ok": True, "grid_beats": [0.3 + 0.5 * k for k in range(20)], "grid_index_start": 0,
             "downbeat_phase4": 2, "period_s": 0.5, "downbeat_margin": 0.8}
    g = build({"ok": True, "method": "downbeat_only"}, beats, {"duration_s": 10.0})
    c = chunks(g, 8)
    assert c[0] == {"start": 0.0, "end": 1.3, "count_label": None}   # lead-in before the first bar
    assert c[1]["start"] == 1.3 and c[1]["end"] == 5.3                 # 8 beats from the first bar
    assert all(x["count_label"] is None for x in c)                   # ambiguous: no 1/5 labels


def test_short_non_digit_segments_are_not_speech():
    tr = [{"start": 0.75, "end": 1.55, "digit_density": 0.0}]
    g = build(_phase([0.0, 4.0], 4.0, tr), {"ok": False}, {"duration_s": 8.0})
    assert g["speech_spans"] == []
