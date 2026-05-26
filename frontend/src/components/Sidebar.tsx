import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  FileStack,
  ScrollText,
  Briefcase,
  Users as UsersIcon,
  Globe,
  UserCog,
  Building2,
  Wallet,
  UserRoundSearch,
  X,
} from 'lucide-react';

const items = [
  { to: '/', label: 'Anasayfa', icon: LayoutDashboard, end: true },
  { to: '/leads', label: 'Potansiyel Müşteriler', icon: UserRoundSearch },
  { to: '/offers', label: 'Teklifler', icon: FileText },
  { to: '/offer-templates', label: 'Teklif Şablonları', icon: FileStack },
  { to: '/agreements', label: 'Sözleşmeler', icon: ScrollText },
  { to: '/projects', label: 'Projeler', icon: Briefcase },
  { to: '/finance', label: 'Gelir / Gider', icon: Wallet },
  { to: '/clients', label: 'Müşteriler', icon: Building2 },
  { to: '/personnel', label: 'Personel', icon: UserCog },
  { to: '/users', label: 'Kullanıcılar', icon: UsersIcon },
  { to: '/domains', label: 'Domainler', icon: Globe },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: Props) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 shrink-0 bg-ink-900 text-ink-100 flex flex-col
          transform transition-transform duration-200 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        <div className="px-6 py-5 border-b border-ink-800 flex items-center justify-between">
          <div>
            <div className="text-xl font-bold tracking-wide">Umutcan Bozyiğit</div>
            <div className="text-xs text-ink-400 mt-1">CRM Panel</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden text-ink-300 hover:text-white p-1"
            aria-label="Menüyü kapat"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-2.5 text-sm transition-colors ${
                  isActive ? 'bg-ink-800 text-white border-l-2 border-white' : 'text-ink-300 hover:bg-ink-800 hover:text-white'
                }`
              }
            >
              <it.icon size={18} />
              <span>{it.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
