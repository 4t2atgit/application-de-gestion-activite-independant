import { CalendarDays, CircleHelp, FolderKanban, LayoutDashboard, Menu, Receipt, ReceiptText, Settings, Trash2, UsersRound, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useState } from 'react';

const items: Array<{ to: string; label: string; icon: typeof LayoutDashboard; end?: boolean }> = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'Clients', icon: UsersRound },
  { to: '/projets', label: 'Projets', icon: FolderKanban },
  { to: '/heures', label: 'Heures', icon: CalendarDays },
  { to: '/factures', label: 'Factures', icon: ReceiptText },
  { to: '/frais', label: 'Frais', icon: Receipt },
  { to: '/corbeille', label: 'Corbeille', icon: Trash2 },
  { to: '/parametrages', label: 'Paramètres', icon: Settings },
  { to: '/aide', label: 'Aide', icon: CircleHelp },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="rounded-2xl bg-slate-900 p-4 text-white shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-slate-300">Micro-entreprise</p>
          <h1 className="text-2xl font-semibold">Suivi d'activité local</h1>
        </div>
        <button className="inline-flex items-center justify-center rounded-full bg-slate-800 p-2 text-slate-100 hover:bg-slate-700 md:hidden" type="button" title={isOpen ? 'Fermer la navigation' : 'Ouvrir la navigation'} aria-label={isOpen ? 'Fermer la navigation' : 'Ouvrir la navigation'} aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)}>
          {isOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
        <div className={`${isOpen ? 'flex' : 'hidden'} w-full flex-wrap gap-2 md:flex md:w-auto`}>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setIsOpen(false)}
                title={item.label}
                aria-label={item.label}
                className={({ isActive }) => `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
                  isActive ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
