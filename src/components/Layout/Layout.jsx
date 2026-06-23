import { Sidebar } from './Sidebar'

export function Layout({ children }) {
  return (
    <div className="flex h-screen bg-base text-gray-100 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
