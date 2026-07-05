import { RefreshCw } from 'lucide-react';

// Bir liste/veri yüklemesi başarısız olduğunda gösterilen kurtarma durumu.
export default function ErrorState({
  onRetry,
  message = 'Veriler yüklenemedi.',
}: {
  onRetry?: () => void;
  message?: string;
}) {
  return (
    <div className="grid place-items-center py-16 text-center">
      <div className="space-y-3">
        <p className="text-sm text-ink-500">{message}</p>
        {onRetry && (
          <button className="btn-secondary mx-auto" onClick={onRetry}>
            <RefreshCw size={14} /> Tekrar dene
          </button>
        )}
      </div>
    </div>
  );
}
