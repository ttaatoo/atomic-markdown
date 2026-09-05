import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

/** Last-resort UI so a mermaid/React throw cannot leave a solid gray panel. */
export class WebviewErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Isolation listeners also swallow mermaid window errors.
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="atomic-fatal" role="alert">
          The editor hit an error. Use <strong>Developer: Reload Window</strong> to recover.
        </div>
      );
    }
    return this.props.children;
  }
}
