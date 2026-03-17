import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface CanvasErrorBoundaryProps {
  children: ReactNode
  /** Changing this key resets the boundary after the user fixes the template. */
  resetKey: unknown
}

interface CanvasErrorBoundaryState { error: Error | null }

export class CanvasErrorBoundary extends Component<CanvasErrorBoundaryProps, CanvasErrorBoundaryState> {
  state: CanvasErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): CanvasErrorBoundaryState {
    return { error }
  }

  componentDidUpdate(prev: CanvasErrorBoundaryProps) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) { /* logged to console by React */ }

  render() {
    if (this.state.error) {
      return (
        <p className="stage-hint stage-error">
          Render error: {this.state.error.message}
        </p>
      )
    }
    return this.props.children
  }
}
