import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Input, Textarea } from '../ui/Field'

export function ForecastSessionModal({ isOpen, onClose, onSave }) {
  const [form, setForm] = useState({ name: '', description: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    await window.api.forecast.createSession(form)
    onSave()
    onClose()
    setForm({ name: '', description: '' })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouvelle session prévisionnelle">
      <div className="space-y-4">
        <Field label="Nom de la simulation">
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Courses fin de mois" />
        </Field>
        <Field label="Description (optionnel)">
          <Textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Contexte, remarques…" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={!form.name}>Créer</Button>
        </div>
      </div>
    </Modal>
  )
}
