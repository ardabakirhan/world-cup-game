import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import { useGame } from './store/gameStore'
import { teamColor } from './data/teamColors'
import i18n from './i18n'
import { TabBar } from './components/TabBar'
import { EventDialog } from './components/EventDialog'
import { MainMenu } from './screens/MainMenu'
import { NewGame } from './screens/NewGame'
import { TeamSelect } from './screens/TeamSelect'
import { Home } from './screens/Home'
import { Squad } from './screens/Squad'
import { PlayerDetail } from './screens/PlayerDetail'
import { Tactics } from './screens/Tactics'
import { MatchLive } from './screens/MatchLive'
import { Tournament } from './screens/Tournament'
import { Summary } from './screens/Summary'
import { Profile } from './screens/Profile'
import { Federation } from './screens/Federation'
import { SquadSelection } from './screens/SquadSelection'
import { PlayerPool } from './screens/PlayerPool'
import { LineupConfirm } from './screens/LineupConfirm'

function Shell() {
  const teamId = useGame((s) => s.teamId)
  const lang = useGame((s) => s.lang)
  const loc = useLocation()

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', teamId ? teamColor(teamId) : '#e11d2e')
  }, [teamId])

  useEffect(() => {
    if (i18n.language !== lang) void i18n.changeLanguage(lang)
  }, [lang])

  useEffect(() => {
    const sub = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back()
      else void CapApp.minimizeApp()
    })
    return () => { void sub.then((h) => h.remove()) }
  }, [])

  const noTabs = ['/menu', '/newgame', '/select', '/match', '/lineup'].some((p) => loc.pathname.startsWith(p))
  const showTabs = teamId && !noTabs

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/menu" element={<MainMenu />} />
          <Route path="/newgame" element={<NewGame />} />
          {/* legacy direct-select route kept for compatibility */}
          <Route path="/select" element={<TeamSelect />} />
          <Route path="/home" element={teamId ? <Home /> : <Navigate to="/menu" />} />
          <Route path="/squad" element={teamId ? <Squad /> : <Navigate to="/menu" />} />
          <Route path="/squad/:playerId" element={teamId ? <PlayerDetail /> : <Navigate to="/menu" />} />
          <Route path="/tactics" element={teamId ? <Tactics /> : <Navigate to="/menu" />} />
          <Route path="/lineup" element={teamId ? <LineupConfirm /> : <Navigate to="/menu" />} />
          <Route path="/match" element={teamId ? <MatchLive /> : <Navigate to="/menu" />} />
          <Route path="/tournament" element={teamId ? <Tournament /> : <Navigate to="/menu" />} />
          <Route path="/summary" element={teamId ? <Summary /> : <Navigate to="/menu" />} />
          <Route path="/profile" element={teamId ? <Profile /> : <Navigate to="/menu" />} />
          <Route path="/federation" element={teamId ? <Federation /> : <Navigate to="/menu" />} />
          <Route path="/squad-selection" element={teamId ? <SquadSelection /> : <Navigate to="/menu" />} />
          <Route path="/player-pool" element={teamId ? <PlayerPool /> : <Navigate to="/menu" />} />
          <Route path="*" element={<Navigate to={teamId ? '/home' : '/menu'} />} />
        </Routes>
      </div>
      {showTabs && <TabBar />}
      <EventDialog />
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
