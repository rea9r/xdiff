package main

func asRunError(code int, err error) *runError {
	return &runError{
		code: code,
		err:  err,
	}
}

type runError struct {
	code int
	err  error
}

func (e *runError) Error() string {
	return e.err.Error()
}

func (e *runError) Unwrap() error {
	return e.err
}
