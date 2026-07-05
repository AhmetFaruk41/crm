// Etiket renk paleti — Leads ve Drive modüllerinde ortak.
export const TAG_COLOR_OPTIONS: { value: string; label: string; chip: string; dot: string }[] = [
  { value: 'slate', label: 'Gri', chip: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400' },
  { value: 'red', label: 'Kırmızı', chip: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
  { value: 'amber', label: 'Sarı', chip: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  { value: 'lime', label: 'Açık Yeşil', chip: 'bg-lime-50 text-lime-800 ring-lime-200', dot: 'bg-lime-500' },
  { value: 'emerald', label: 'Yeşil', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  { value: 'sky', label: 'Mavi', chip: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500' },
  { value: 'indigo', label: 'Lacivert', chip: 'bg-indigo-50 text-indigo-700 ring-indigo-200', dot: 'bg-indigo-500' },
  { value: 'violet', label: 'Mor', chip: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
  { value: 'pink', label: 'Pembe', chip: 'bg-pink-50 text-pink-700 ring-pink-200', dot: 'bg-pink-500' },
  { value: 'rose', label: 'Gül', chip: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
];

export function tagChipClass(color: string): string {
  return TAG_COLOR_OPTIONS.find((item) => item.value === color)?.chip ?? TAG_COLOR_OPTIONS[0].chip;
}

export function tagDotClass(color: string): string {
  return TAG_COLOR_OPTIONS.find((item) => item.value === color)?.dot ?? TAG_COLOR_OPTIONS[0].dot;
}
