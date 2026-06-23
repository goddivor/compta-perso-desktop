import { contextBridge, ipcRenderer } from 'electron'

const invoke = (ch, ...args) => ipcRenderer.invoke(ch, ...args)

contextBridge.exposeInMainWorld('api', {
  accounts: {
    getAll:  ()     => invoke('accounts:getAll'),
    create:  (d)    => invoke('accounts:create', d),
    update:  (d)    => invoke('accounts:update', d),
    remove:  (id)   => invoke('accounts:remove', id),
    reorder: (ids)  => invoke('accounts:reorder', ids),
  },
  transactions: {
    getAll:          (f)  => invoke('transactions:getAll', f),
    getById:         (id) => invoke('transactions:getById', id),
    create:          (d)  => invoke('transactions:create', d),
    update:          (d)  => invoke('transactions:update', d),
    remove:          (id) => invoke('transactions:remove', id),
  },
  transfers: {
    create:          (d) => invoke('transfers:create', d),
    update:          (d) => invoke('transfers:update', d),
    convertToSimple: (d) => invoke('transfers:convertToSimple', d),
  },
  categories: {
    getAll:  ()     => invoke('categories:getAll'),
    create:  (d)    => invoke('categories:create', d),
    update:  (d)    => invoke('categories:update', d),
    remove:  (id)   => invoke('categories:remove', id),
  },
  forecast: {
    getSessions:     ()       => invoke('forecast:getSessions'),
    createSession:   (d)      => invoke('forecast:createSession', d),
    getSession:      (id)     => invoke('forecast:getSession', id),
    addTransaction:  (d)      => invoke('forecast:addTransaction', d),
    validateSession: (id)     => invoke('forecast:validateSession', id),
    deleteSession:   (id)     => invoke('forecast:deleteSession', id),
    addTransfer:      (d)      => invoke('forecast:addTransfer', d),
  },
  stats: {
    getSummary:           ()  => invoke('stats:getSummary'),
    getDailyReport:       (p) => invoke('stats:getDailyReport', p),
    getBalanceHistory:    (p) => invoke('stats:getBalanceHistory', p),
    getExpensesByCategory:(p) => invoke('stats:getExpensesByCategory', p),
    getMonthlyFlow:       (p) => invoke('stats:getMonthlyFlow', p),
  },
})
