import { cloneElement, isValidElement, useId, type ReactNode } from 'react';

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  const autoId = useId();

  // Erişilebilirlik: etiketi input'a programatik olarak bağla. Child tek bir
  // native form elemanıysa (input/select/textarea) id'yi ona enjekte edip
  // htmlFor kur. Native olmayan (özel bileşen) child'larda eski davranış
  // korunur (bağlama yapılmaz, regresyon yok).
  let control = children;
  let htmlFor: string | undefined;
  if (isValidElement(children)) {
    const props = children.props as { id?: string };
    if (props.id) {
      htmlFor = props.id;
    } else if (typeof children.type === 'string') {
      htmlFor = autoId;
      control = cloneElement(children as React.ReactElement<{ id?: string }>, { id: autoId });
    }
  }

  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {control}
    </div>
  );
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}
