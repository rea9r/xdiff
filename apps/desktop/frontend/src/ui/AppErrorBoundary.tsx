import { Component, type ErrorInfo, type ReactNode } from 'react'

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  error: Error | null
  componentStack: string | null
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null, componentStack: null }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error, componentStack: null }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App render error:', error, info.componentStack)
    this.setState({ componentStack: info.componentStack ?? null })
  }

  handleReload = () => {
    this.setState({ error: null, componentStack: null })
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div className="app-error-boundary">
        <div className="app-error-boundary-card">
          <h2>Something went wrong</h2>
          <p className="app-error-boundary-message">{this.state.error.message}</p>
          {this.state.error.stack ? (
            <pre className="app-error-boundary-stack">{this.state.error.stack}</pre>
          ) : null}
          {this.state.componentStack ? (
            <pre className="app-error-boundary-stack">{this.state.componentStack}</pre>
          ) : null}
          <button
            type="button"
            className="button-secondary"
            onClick={this.handleReload}
          >
            Try to recover
          </button>
        </div>
      </div>
    )
  }
}
