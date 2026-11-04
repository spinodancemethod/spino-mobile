from pathlib import Path

from fable.config import Config
from fable.phase import Digit, cycles_from_digits, digit_density, normalise_digit, structural_ok, vote_phase

CFG = Config(video=Path("x"), out=Path("y"))


def _d(value, t, k=None, accepted=True, prob=0.9):
    return Digit(value=value, t=t, word=str(value), probability=prob, lexical_weight=1.0,
                 onset_strength=1.0, beat_index=k, beat_offset_s=0.0, accepted=accepted)


def test_normalise_digit_words_and_numerals():
    assert normalise_digit("One") == (1, 1.0)
    assert normalise_digit(" 5.") == (5, 1.0)
    assert normalise_digit("for")[0] == 4 and normalise_digit("for")[1] < 1
    assert normalise_digit("hello") is None


def test_digit_density():
    assert digit_density(" one two three four five six seven eight") == 1.0
    assert digit_density("thanks for watching") < 0.5


def test_vote_phase_counts_every_digit_not_only_ones():
    digits = [_d(v, 8 + v * 0.5, 16 + (v - 1)) for v in range(1, 9)]
    phase, margin, bins, margin4 = vote_phase(digits)
    assert phase == 0 and margin == 1.0


def test_vote_phase_with_offset_grid_and_dropped_word():
    digits = [_d(v, v, 3 + (v - 1)) for v in (1, 2, 3, 4, 6, 7, 8)]
    phase, margin, *_ = vote_phase(digits)
    assert phase == 3 and margin == 1.0


def test_vote_phase_1_vs_5_ambiguity_is_detectable():
    a = [_d(v, v, (v - 1)) for v in (1, 2, 3, 4)]
    b = [_d(v, 10 + v, (v - 1) - 4) for v in (5, 6, 7, 8)]
    phase, margin, bins, margin4 = vote_phase(a + b)
    assert margin == 0.0 and margin4 == 1.0


def test_structural_rejects_scattered_digits():
    digits = [_d(1, 0.0), _d(4, 3.1), _d(2, 7.7), _d(7, 12.0)]
    ok, _ = structural_ok(digits, 0.5, CFG)
    assert not ok


def test_structural_accepts_isochronous_run():
    digits = [_d(v, (v - 1) * 0.5) for v in range(1, 6)]
    ok, _ = structural_ok(digits, 0.5, CFG)
    assert ok


def test_structural_accepts_every_other_beat_counting():
    digits = [_d(v, (v - 1) * 1.0) for v in (1, 2, 3, 4)]
    ok, _ = structural_ok(digits, 0.5, CFG)
    assert ok


def test_cycles_from_digits_groups_and_estimates_t1():
    T = 0.8
    digits = []
    for cyc, t1 in enumerate((1.0, 7.4, 13.8)):
        for v in range(1, 9):
            if cyc == 1 and v == 1:
                continue  # dropped "one" in the second cycle must still yield a t1
            digits.append(_d(v, t1 + (v - 1) * T))
    cycles = cycles_from_digits(digits, T)
    assert [c["cycle"] for c in cycles] == [0, 1, 2]
    assert [round(c["t1"], 2) for c in cycles] == [1.0, 7.4, 13.8]
    assert [c["has_one"] for c in cycles] == [True, False, True]


def test_cycles_from_digits_splits_on_restart():
    digits = [_d(5, 0.0), _d(6, 0.5), _d(7, 1.0), _d(8, 1.5), _d(1, 2.0), _d(2, 2.5)]
    cycles = cycles_from_digits(digits, 0.5)
    assert len(cycles) == 2 and round(cycles[0]["t1"], 2) == -2.0 and round(cycles[1]["t1"], 2) == 2.0


def test_cycles_from_digits_trusts_a_clear_spoken_one_over_tempo():
    # Finish counted fast (0.5 s/count) after a 0.8 s/count body: "one" at 30.08 wins.
    T = 0.8
    digits = [_d(v, 23.2 + (v - 1) * T) for v in range(1, 9)]
    digits += [_d(1, 30.08, prob=0.96), _d(2, 30.4), _d(6, 32.8), _d(7, 33.02)]
    cycles = cycles_from_digits(digits, T)
    assert len(cycles) == 2
    assert cycles[1]["t1"] == 30.08 and cycles[1]["t1_source"] == "spoken_one"


def test_cycles_from_digits_tolerates_duplicates_and_mistimed_words():
    T = 0.8
    digits = [_d(v, 1.0 + (v - 1) * T) for v in range(1, 9)]
    digits += [_d(5, 1.0 + 4 * T + 0.3), _d(6, 1.0 + 5 * T - 0.25)]  # window-overlap duplicates
    digits += [_d(v, 7.4 + (v - 1) * T) for v in (2, 3, 4, 6, 7, 8)]
    cycles = cycles_from_digits(digits, T)
    assert len(cycles) == 2
    assert abs(cycles[0]["t1"] - 1.0) < 0.15 and abs(cycles[1]["t1"] - 7.4) < 0.15


def test_bar_times_interleave_count5_midpoints():
    from fable.phase import bar_times_from_count1
    bars = bar_times_from_count1([0.0, 6.0, 12.4], cycle_len_s=6.0, duration_s=17.0)
    assert [round(b, 6) for b in bars] == [0.0, 3.0, 6.0, 9.2, 12.4, 15.4]


def test_bar_times_drop_count5_past_video_end():
    from fable.phase import bar_times_from_count1
    assert bar_times_from_count1([0.0, 6.0], cycle_len_s=6.0, duration_s=8.0) == [0.0, 3.0, 6.0]
