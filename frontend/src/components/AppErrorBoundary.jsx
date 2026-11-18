import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Application render error:', error);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <section
        role="alert"
        style={{
          maxWidth: '640px',
          margin: '80px auto',
          padding: '32px 24px',
          textAlign: 'center',
        }}
      >
        <h1>Something went wrong</h1>
        <p>We could not load this page. Please try again.</p>
        <button type="button" className="btn btn-primary" onClick={this.handleReload}>
          Reload page
        </button>
      </section>
    );
  }
}
