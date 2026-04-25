package sample

// Service is the new abstraction added on the right side only.
type Service struct {
	app *App
}

// NewService wires an App into a Service.
func NewService(app *App) *Service {
	return &Service{app: app}
}
