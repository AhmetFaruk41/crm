export default function Loading({ label = 'Yükleniyor...' }: { label?: string }) {
  return (
    <div className="grid place-items-center py-16 text-ink-500 text-sm">
      <div className="animate-pulse">{label}</div>
    </div>
  );
}
