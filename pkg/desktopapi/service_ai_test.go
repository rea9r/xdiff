package desktopapi

import "testing"

func TestPullAggregator_AccumulatesAcrossLayers(t *testing.T) {
	agg := newPullAggregator()

	// Layer A: 0 → 100 of 100.
	c, total, pct := agg.observe("pulling aaa", 100, 0)
	if c != 0 || total != 100 || pct != 0 {
		t.Fatalf("layer A start: got (%d, %d, %v), want (0, 100, 0)", c, total, pct)
	}
	c, total, pct = agg.observe("pulling aaa", 100, 50)
	if c != 50 || total != 100 || pct != 50 {
		t.Fatalf("layer A mid: got (%d, %d, %v), want (50, 100, 50)", c, total, pct)
	}
	c, total, pct = agg.observe("pulling aaa", 100, 100)
	if c != 100 || total != 100 || pct != 100 {
		t.Fatalf("layer A done: got (%d, %d, %v), want (100, 100, 100)", c, total, pct)
	}

	// Layer B starts: cumulative total grows to 300, completed must NOT drop.
	c, total, _ = agg.observe("pulling bbb", 200, 0)
	if c != 100 || total != 300 {
		t.Fatalf("layer B start cumulative: got (%d, %d), want (100, 300)", c, total)
	}
	c, total, _ = agg.observe("pulling bbb", 200, 200)
	if c != 300 || total != 300 {
		t.Fatalf("layer B done cumulative: got (%d, %d), want (300, 300)", c, total)
	}
}

func TestPullAggregator_IgnoresZeroTotalFrames(t *testing.T) {
	agg := newPullAggregator()

	agg.observe("pulling aaa", 100, 100)

	// "verifying sha256 digest" arrives with total=0 — must not perturb totals.
	c, total, pct := agg.observe("verifying sha256 digest", 0, 0)
	if c != 100 || total != 100 || pct != 100 {
		t.Fatalf("zero-total frame must be ignored: got (%d, %d, %v), want (100, 100, 100)", c, total, pct)
	}

	c, total, pct = agg.observe("writing manifest", 0, 0)
	if c != 100 || total != 100 || pct != 100 {
		t.Fatalf("zero-total frame must be ignored: got (%d, %d, %v), want (100, 100, 100)", c, total, pct)
	}
}

func TestPullAggregator_MonotonicCompletedPerLayer(t *testing.T) {
	agg := newPullAggregator()

	agg.observe("pulling aaa", 100, 80)
	// Out-of-order frame with a smaller `completed` must not regress the layer.
	c, total, pct := agg.observe("pulling aaa", 100, 30)
	if c != 80 || total != 100 || pct != 80 {
		t.Fatalf("regressed completed must be ignored: got (%d, %d, %v), want (80, 100, 80)", c, total, pct)
	}
}

// When a new layer is registered with `completed=0`, the cumulative total
// jumps before any of the layer's bytes have been pulled. The naive ratio
// dips (e.g. 100/(100+200) → 33%); the returned percent must instead stay
// at the previous high. This is the bug the user reported as "0→100 を
// 繰り返す" when re-pulling a partly-cached model.
func TestPullAggregator_PercentNeverRegressesAcrossLayers(t *testing.T) {
	agg := newPullAggregator()

	_, _, pct := agg.observe("pulling aaa", 100, 0)
	if pct != 0 {
		t.Fatalf("layer A start: pct=%v, want 0", pct)
	}
	_, _, pct = agg.observe("pulling aaa", 100, 100)
	if pct != 100 {
		t.Fatalf("layer A done: pct=%v, want 100", pct)
	}

	// Naive ratio would be 100/300 = 33.3 %; clamped to last high (100).
	_, _, pct = agg.observe("pulling bbb", 200, 0)
	if pct != 100 {
		t.Fatalf("layer B start must not drop pct: got %v, want 100", pct)
	}
	_, _, pct = agg.observe("pulling bbb", 200, 100)
	if pct != 100 {
		t.Fatalf("layer B mid: got pct=%v, want 100", pct)
	}
	_, _, pct = agg.observe("pulling bbb", 200, 200)
	if pct != 100 {
		t.Fatalf("layer B done: got pct=%v, want 100", pct)
	}

	// Yet another layer registers — still no dip.
	_, _, pct = agg.observe("pulling ccc", 50, 0)
	if pct != 100 {
		t.Fatalf("layer C start must not drop pct: got %v, want 100", pct)
	}
}
