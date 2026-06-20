import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout }       from './components/Layout/Layout'
import { Dashboard }    from './components/Dashboard/Dashboard'
import { Accounts }     from './components/Accounts/Accounts'
import { Transactions } from './components/Transactions/Transactions'
import { Forecast }     from './components/Forecast/Forecast'
import { Charts }       from './components/Charts/Charts'
import { Settings }     from './components/Settings/Settings'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/"             element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"    element={<Dashboard />} />
        <Route path="/accounts"     element={<Accounts />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/forecast"     element={<Forecast />} />
        <Route path="/charts"       element={<Charts />} />
        <Route path="/settings"     element={<Settings />} />
      </Routes>
    </Layout>
  )
}
