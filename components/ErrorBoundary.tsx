import React from 'react';

interface Props {
  children: React.ReactNode;
  label?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.label ?? '', error, info);
  }

  retry = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-slate-700 bg-slate-900 text-center">
          <p className="text-slate-400 text-sm">
            {this.props.label
              ? `${this.props.label} ran into a problem.`
              : 'Something went wrong.'}
          </p>
          <p className="text-slate-600 text-xs font-mono truncate max-w-xs">
            {this.state.error.message}
          </p>
          <button
            onClick={this.retry}
            className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs transition"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
