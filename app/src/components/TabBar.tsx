import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const tabs = [
  { to: '/home',       key: 'home',       icon: '🏠' },
  { to: '/squad',      key: 'squad',      icon: '👥' },
  { to: '/tactics',    key: 'tactics',    icon: '📋' },
  { to: '/tournament', key: 'tournament', icon: '🏆' },
  { to: '/federation', key: 'federation', icon: '🏛' },
  { to: '/profile',    key: 'profile',    icon: '👤' },
]

export function TabBar() {
  const { t } = useTranslation()
  return (
    <nav className="sticky bottom-0 z-40 flex border-t border-[var(--line)] bg-[var(--card)] pb-[env(safe-area-inset-bottom)]"
      style={{ minHeight: 52 }}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5"
          style={({ isActive }) => ({ color: isActive ? 'var(--accent)' : 'var(--muted)' })}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
          <span style={{ fontSize: 9, fontWeight: 600 }}>{t(`tabs.${tab.key}`)}</span>
        </NavLink>
      ))}
    </nav>
  )
}
