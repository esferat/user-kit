import { Component, type ErrorInfo, type ReactNode } from 'react';

import { StartupError } from './StartupError';

export interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: unknown;
}

/**
 * Перехватывает сбой первого рендера — например, сломанную конфигурацию — и
 * показывает его вместо пустой страницы. Всё, что ниже shell, обрабатывает
 * свои сбои, поэтому boundary охраняет только старт приложения.
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
