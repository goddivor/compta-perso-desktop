// Shown name of a category. A built-in category (builtin_key set) that still
// carries one of its default names (fr or en, accent- and case-insensitive,
// so the v1 'Sante' and 'Vetements' count) is shown in the current language
// (categories.builtin.<key>); a renamed or user-created one shows its stored
// name as typed. The stored name is never changed.
// Same rule and names as the mobile app (src/db/database.js categoryLabel)
// and electron/main/db.js BUILTIN_CATEGORIES.
const DEFAULT_NAMES = {
  food: ['Nourriture', 'Food'],
  fuel: ['Essence', 'Fuel'],
  transport: ['Transport', 'Transport'],
  health: ['Santé', 'Health'],
  clothes: ['Vêtements', 'Clothes'],
  leisure: ['Loisirs', 'Leisure'],
  bills: ['Factures', 'Bills'],
  salary: ['Salaire', 'Salary'],
  freelance: ['Freelance', 'Freelance'],
  withdrawal: ['Retrait', 'Withdrawal'],
  other: ['Autres', 'Other'],
}

const normalizeName = (name) =>
  String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

const BUILTIN_NAMES = new Map(
  Object.entries(DEFAULT_NAMES).map(([key, names]) => [key, new Set(names.map(normalizeName))])
)

export function categoryLabel(t, builtinKey, name) {
  if (builtinKey && BUILTIN_NAMES.get(builtinKey)?.has(normalizeName(name))) {
    return t(`categories.builtin.${builtinKey}`)
  }
  return name
}

// Shown name of a category row ({ name, builtin_key })
export const catName = (t, c) => (c ? categoryLabel(t, c.builtin_key, c.name) : '')

// Shown category name of a transaction row (category_name, category_builtin_key)
export const txCategoryName = (t, tx) =>
  tx?.category_name ? categoryLabel(t, tx.category_builtin_key, tx.category_name) : tx?.category_name

// Name to store when an edit is saved: the stored name while the text is the
// one shown when the edit opened (whatever the language is now), else the
// typed text. An untouched built-in name is never rewritten.
export const nameToSave = (storedName, shownAtEdit, typed) =>
  (typed === shownAtEdit ? storedName : typed)

// Categories in the order of the list (flow, then shown name)
export const sortCategories = (t, cats) =>
  [...(cats || [])].sort((a, b) =>
    String(a.flow).localeCompare(String(b.flow)) || catName(t, a).localeCompare(catName(t, b)))
