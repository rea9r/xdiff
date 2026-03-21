package runner

type UserHintError struct {
	Message string
	Hints   []string
}

func (e *UserHintError) Error() string {
	return e.Message
}

func newUserHintError(message string, hints ...string) *UserHintError {
	return &UserHintError{
		Message: message,
		Hints:   append([]string(nil), hints...),
	}
}
