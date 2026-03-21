package cli

import "io"

func writeOutput(w io.Writer, out string) error {
	if out == "" {
		return nil
	}
	_, err := io.WriteString(w, out)
	return err
}
