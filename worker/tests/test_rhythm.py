import numpy as np

from fable.rhythm import _fit_grid


def test_fit_grid_recovers_true_period_from_rounded_beats():
    # Beat This! emits beat times at ~10 ms resolution. With a true period of
    # 0.5714 s the rounded diffs alternate 0.56/0.58 and their median (0.58) is
    # wrong by 9 ms per beat; the old index assignment drifted 2 s over 140 s.
    T_true = 60 / 105.0
    raw = np.round(0.0 + np.arange(246) * T_true, 2)
    t0, T = _fit_grid(raw, period=float(np.median(np.diff(raw))))
    assert abs(T - T_true) < 0.0005
    assert abs(t0) < 0.02
    last = t0 + 245 * T
    assert abs(last - raw[-1]) < 0.03  # no drift at the far end


def test_fit_grid_tolerates_missing_beats():
    T_true = 0.5
    k = np.array([0, 1, 2, 4, 5, 6, 9, 10, 11, 12])  # gaps at 3, 7, 8
    raw = 1.0 + k * T_true
    t0, T = _fit_grid(raw, period=0.5)
    assert abs(T - 0.5) < 1e-6 and abs(t0 - 1.0) < 1e-6
