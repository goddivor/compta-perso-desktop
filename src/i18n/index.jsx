import { createContext, useContext, useMemo, useState } from 'react'
import { fr } from './fr'
import { en } from './en'
import { setFormatLocale } from '../utils/format'

const DICTS = { fr, en }
const STORAGE_KEY = 'app_language' // 'system' | 'fr' | 'en'

function systemLang() {
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'fr'
  return nav.toLowerCase().startsWith('en') ? 'en' : 'fr'
}

function resolveLang(pref) {
  return pref === 'fr' || pref === 'en' ? pref : systemLang()
}

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [pref, setPref] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'system' } catch (_) { return 'system' }
  })

  const lang = resolveLang(pref)
  const locale = lang === 'en' ? 'en-US' : 'fr-FR'
  // Applique la locale aux helpers de formatage avant le rendu des enfants
  setFormatLocale(locale)

  const setLanguage = (next) => {
    try { localStorage.setItem(STORAGE_KEY, next) } catch (_) {}
    setPref(next)
  }

  const value = useMemo(() => {
    const dict = DICTS[lang]
    const t = (key, vars) => {
      let s = dict[key] ?? DICTS.fr[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.split(`{${k}}`).join(String(v))
        }
      }
      return s
    }
    return { t, lang, locale, pref, setLanguage }
  }, [lang, pref])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}

// Hook principal : const t = useT(); t('settings.title')
export function useT() {
  return useContext(I18nContext).t
}
