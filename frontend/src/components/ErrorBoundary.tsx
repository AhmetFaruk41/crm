import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

// Bir render hatasında tüm uygulamanın beyaz ekrana düşmesini önler;
// kullanıcıya kurtarma seçeneği (sayfayı yenile) sunar.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen grid place-items-center p-6 text-center">
          <div className="max-w-md space-y-3">
            <h1 className="text-lg font-semibold text-ink-900">Bir şeyler ters gitti</h1>
            <p className="text-sm text-ink-500">
              Beklenmedik bir hata oluştu. Sayfayı yenilemeyi deneyin; sorun sürerse yöneticinize bildirin.
            </p>
            <button className="btn-primary mx-auto" onClick={() => window.location.reload()}>
              Sayfayı yenile
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
