package main

import "os"

func writeStdout(s string) error {
	return writeString(os.Stdout, s)
}

func writeStderr(s string) error {
	return writeString(os.Stderr, s)
}

func writeString(f *os.File, s string) error {
	_, err := f.WriteString(s)
	return err
}
