package textdiff

import "testing"

func TestNormalize_NoOptions(t *testing.T) {
	in := "Hello  World\r\nFoo\tBar\n"
	got := Normalize(in, NormalizeOptions{})
	if got != in {
		t.Fatalf("expected unchanged input, got=%q", got)
	}
}

func TestNormalize_IgnoreEOL(t *testing.T) {
	got := Normalize("a\r\nb\rc\nd", NormalizeOptions{IgnoreEOL: true})
	want := "a\nb\nc\nd"
	if got != want {
		t.Fatalf("got=%q want=%q", got, want)
	}
}

func TestNormalize_IgnoreWhitespace(t *testing.T) {
	got := Normalize("  hello   world  \n\tfoo\tbar\n", NormalizeOptions{IgnoreWhitespace: true})
	want := "hello world\nfoo bar\n"
	if got != want {
		t.Fatalf("got=%q want=%q", got, want)
	}
}

func TestNormalize_IgnoreCase(t *testing.T) {
	got := Normalize("Hello WORLD", NormalizeOptions{IgnoreCase: true})
	want := "hello world"
	if got != want {
		t.Fatalf("got=%q want=%q", got, want)
	}
}

func TestNormalize_AllCombined(t *testing.T) {
	got := Normalize("Hello   WORLD\r\n\tFoo\n", NormalizeOptions{
		IgnoreWhitespace: true,
		IgnoreCase:       true,
		IgnoreEOL:        true,
	})
	want := "hello world\nfoo\n"
	if got != want {
		t.Fatalf("got=%q want=%q", got, want)
	}
}

func TestCompare_RespectsNormalizationViaCaller(t *testing.T) {
	// Sanity: callers normalize before invoking Compare.
	old := Normalize("Hello   World\n", NormalizeOptions{IgnoreWhitespace: true})
	new_ := Normalize("Hello World\n", NormalizeOptions{IgnoreWhitespace: true})
	got := Compare(old, new_)
	if len(got) != 0 {
		t.Fatalf("expected no diffs, got=%v", got)
	}
}
