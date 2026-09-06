import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Keeps one broken component from blanking the whole app.
 *
 * Without this, a render error unmounts the entire tree and the user is left
 * looking at an empty black page with no indication that anything failed —
 * which is exactly what a stringified GeoJSON property once caused here.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ParkingZone: render failed', error, info.componentStack)
  }

  override render(): ReactNode {
    const { error } = this.state
    if (error === null) return this.props.children

    return (
      <div className="crash">
        <h1>Da ist etwas kaputtgegangen</h1>
        <p>
          Die Ansicht konnte nicht dargestellt werden. Ein Neuladen hilft meistens; bleibt der
          Fehler, ist er ein Bug.
        </p>
        <pre>{error.message}</pre>
        <button type="button" className="button" onClick={() => window.location.reload()}>
          Neu laden
        </button>
      </div>
    )
  }
}
