import { NavLink } from 'react-router-dom'
import { LayoutDashboard, CreditCard, ArrowUpDown, TrendingUp, BarChart2, Settings } from 'lucide-react'

const links = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/accounts',     icon: CreditCard,       label: 'Comptes' },
  { to: '/transactions', icon: ArrowUpDown,      label: 'Transactions' },
  { to: '/forecast',     icon: TrendingUp,       label: 'Prévisionnel' },
  { to: '/charts',       icon: BarChart2,        label: 'Graphiques' },
]

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 bg-surface border-r border-edge flex flex-col h-screen">
      <div className="px-5 py-5 border-b border-edge">
        <div className="flex items-center gap-2">
          <span className="text-xl">💰</span>
          <span className="font-bold text-gray-100 text-sm">Compta Perso</span>
        </div>
      </div>

      <nav className="flex-1 py-4 px-2 flex flex-col gap-0.5">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-edge">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-5 py-4 text-sm font-medium transition-colors ${
              isActive ? 'text-blue-400' : 'text-gray-500 hover:text-gray-100'
            }`
          }
        >
          <Settings size={16} />
          Paramètres
        </NavLink>
      </div>
    </aside>
  )
}
