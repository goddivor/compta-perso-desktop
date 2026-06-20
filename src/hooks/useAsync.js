import { useState, useEffect, useCallback } from 'react'

export function useAsync(fn, deps = []) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try   { setData(await fn()) }
    catch (e) { setError(e.message || 'Erreur') }
    finally   { setLoading(false) }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { run() }, [run])
  return { data, loading, error, refetch: run }
}
