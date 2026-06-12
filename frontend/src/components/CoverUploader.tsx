import { useRef, useState, type DragEvent } from 'react';
import { UploadCloud, X, Loader2, ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';

/**
 * Kapak görseli yükleyici — sürükle-bırak veya tıklayarak dosya seç.
 * Yükleme sonrası backend mutlak URL döndürür; o URL `onChange` ile yukarı verilir.
 */
export default function CoverUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function uploadFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Lütfen bir görsel dosyası seçin');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await api.post<{ url: string }>('/blog/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(r.data.url);
      toast.success('Kapak yüklendi');
    } catch {
      // hata mesajı api interceptor tarafından gösterilir
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  if (value) {
    return (
      <div className="relative inline-block">
        <img
          src={value}
          alt="Kapak önizleme"
          className="h-44 w-full max-w-md rounded-lg border border-ink-200 object-cover"
        />
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute top-2 right-2 rounded-full bg-ink-900/80 p-1.5 text-white hover:bg-ink-900"
          title="Kaldır"
        >
          <X size={15} />
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute bottom-2 right-2 rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-white"
        >
          Değiştir
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }} />
      </div>
    );
  }

  return (
    <div
      onClick={() => !busy && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`flex max-w-md cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
        dragOver ? 'border-ink-900 bg-ink-50' : 'border-ink-300 hover:border-ink-400 hover:bg-ink-50'
      }`}
    >
      {busy ? (
        <Loader2 size={26} className="animate-spin text-ink-500" />
      ) : (
        <UploadCloud size={26} className="text-ink-400" />
      )}
      <div className="text-sm text-ink-700">
        {busy ? 'Yükleniyor…' : (
          <><span className="font-medium">Görseli sürükle</span> ya da seçmek için tıkla</>
        )}
      </div>
      <div className="flex items-center gap-1 text-xs text-ink-400">
        <ImageIcon size={12} /> PNG, JPG, WEBP, AVIF · maks. 8MB
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }} />
    </div>
  );
}
