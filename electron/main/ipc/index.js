import { registerAccountsHandlers }     from './accounts.js'
import { registerTransactionsHandlers } from './transactions.js'
import { registerTransfersHandlers }    from './transfers.js'
import { registerCategoriesHandlers }   from './categories.js'
import { registerForecastHandlers }     from './forecast.js'
import { registerStatsHandlers }        from './stats.js'

export function registerIpcHandlers() {
  registerAccountsHandlers()
  registerTransactionsHandlers()
  registerTransfersHandlers()
  registerCategoriesHandlers()
  registerForecastHandlers()
  registerStatsHandlers()
}
