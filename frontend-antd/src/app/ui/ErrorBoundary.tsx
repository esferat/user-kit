import { Component, type ErrorInfo, type ReactNode } from 'react';

import { StartupError } from './StartupError';

export interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: unknown;
}

/**
 * Catches a failure of the first render - a broken configuration for example -
 * and shows it instead of an empty page. Everything below the shell handles its
 * own failures, so the boundary only guards the start of the application.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: undefined };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('The application could not be rendered', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error !== undefined) {
      return <StartupError error={this.state.error} />;
    }
    return this.props.children;
  }
}
