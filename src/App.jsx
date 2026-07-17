import { useState, useCallback } from 'react'
import { useAsync } from './hooks/useAsync'
import { BalanceCards } from './components/BalanceCards'
import { Controls } from './components/Controls'
import { TableView } from './components/TableView'
import { GraphView } from './components/GraphView'
import { TransactionModal } from './components/TransactionModal'
import { TransferModal } from './components/TransferModal'
import { AccountModal } from './components/AccountModal'
import { ForecastModal } from './components/ForecastModal'
import { SettingsModal } from './components/SettingsModal'
import { FeeRuleModal } from './components/FeeRuleModal'
import { SyncModal } from './components/SyncModal'
import { DailyReport } from './components/DailyReport'
import { Spinner } from './components/ui/Spinner'

const emptyFilters = { account_id: '', type: '', category_id: '', date_from: '', date_to: '' }

export default function App() {
  const [filters, setFilters] = useState(emptyFilters)
  const [showForecast, setShowForecast] = useState(false)
  const [viewMode, setViewMode] = useState('tableau')
  const [graphLayout, setGraphLayout] = useState('vertical')

  const setF = (key, value) => setFilters(f => ({ ...f, [key]: value }))

  const [modal, setModal] = useState(null)
  const openModal  = (type, data) => setModal({ type, data })
  const closeModal = () => setModal(null)

  const [tick, setTick] = useState(0)
  const refetch = useCallback(() => setTick(t => t + 1), [])

  const { data: accounts } = useAsync(
    () => window.api.accounts.getAll(), [tick]
  )
  const { data: categories } = useAsync(
    () => window.api.categories.getAll(), [tick]
  )
  const { data: summary } = useAsync(
    () => window.api.stats.getSummary(), [tick]
  )
  const { data: transactions, loading: loadingTx } = useAsync(() => {
    const params = {}
    if (showForecast) params.include_forecast = 1
    if (filters.account_id)  params.account_id  = filters.account_id
    if (filters.type)        params.type        = filters.type
    if (filters.category_id) params.category_id = filters.category_id
    if (filters.date_from)   params.date_from   = filters.date_from
    if (filters.date_to)     params.date_to     = filters.date_to
    return window.api.transactions.getAll(params)
  }, [tick, filters, showForecast])

  const { data: allTransactions } = useAsync(() => {
    const params = {}
    if (showForecast) params.include_forecast = 1
    if (filters.account_id) params.account_id = filters.account_id
    return window.api.transactions.getAll(params)
  }, [tick, showForecast, filters.account_id])

  const handleSave = () => { refetch(); closeModal() }

  return (
    <div className="h-screen flex flex-col bg-base text-ink overflow-hidden">
      <BalanceCards
        summary={summary}
        selectedAccount={filters.account_id ? Number(filters.account_id) : null}
        onSelectAccount={id => setF('account_id', id === '' ? '' : String(id))}
        onAddAccount={() => openModal('account')}
        onSettings={() => openModal('settings')}
        onSync={() => openModal('sync')}
        onReorder={refetch}
      />

      <Controls
        filters={filters}
        setF={setF}
        showForecast={showForecast}
        setShowForecast={setShowForecast}
        viewMode={viewMode}
        setViewMode={setViewMode}
        graphLayout={graphLayout}
        setGraphLayout={setGraphLayout}
        categories={categories}
        accounts={accounts}
        onAddTx={() => openModal('tx')}
        onTransfer={() => openModal('transfer')}
        onForecast={() => openModal('forecast')}
        onFeeRule={acct => openModal('feeRule', acct)}
      />

      <main className="flex-1 overflow-hidden">
        {viewMode === 'rapport' ? (
          <DailyReport filters={filters} tick={tick} />
        ) : viewMode === 'tableau' ? (
          loadingTx
            ? <div className="flex items-center justify-center h-full"><Spinner /></div>
            : (
              <TableView
                transactions={transactions || []}
                accounts={accounts || []}
                onEdit={tx => openModal('tx', tx)}
                onDelete={async id => {
                  if (!confirm('Supprimer cette transaction ?')) return
                  await window.api.transactions.remove(id)
                  refetch()
                }}
              />
            )
        ) : (
          <GraphView
            transactions={allTransactions || []}
            accounts={accounts || []}
            layout={graphLayout}
          />
        )}
      </main>

      {modal?.type === 'tx' && (
        <TransactionModal
          isOpen
          onClose={closeModal}
          onSave={handleSave}
          tx={modal.data}
          accounts={accounts || []}
          categories={categories || []}
          defaultAccountId={modal.data ? undefined : filters.account_id}
        />
      )}
      {modal?.type === 'transfer' && (
        <TransferModal
          isOpen
          onClose={closeModal}
          onSave={handleSave}
          accounts={accounts || []}
        />
      )}
      {modal?.type === 'account' && (
        <AccountModal
          isOpen
          onClose={closeModal}
          onSave={handleSave}
          account={modal.data}
        />
      )}
      {modal?.type === 'forecast' && (
        <ForecastModal
          isOpen
          onClose={closeModal}
          onSave={refetch}
          accounts={accounts || []}
          categories={categories || []}
          defaultAccountId={filters.account_id ? Number(filters.account_id) : undefined}
        />
      )}
      {modal?.type === 'settings' && (
        <SettingsModal
          isOpen
          onClose={closeModal}
          onSave={refetch}
        />
      )}
      {modal?.type === 'feeRule' && (
        <FeeRuleModal
          isOpen
          onClose={closeModal}
          onSave={refetch}
          account={modal.data}
        />
      )}
      {modal?.type === 'sync' && (
        <SyncModal
          isOpen
          onClose={closeModal}
          onSave={refetch}
        />
      )}
    </div>
  )
}
