import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiClient } from '../lib/apiClient'
import { createClassroom } from '../lib/classroomsApi'
import type { ClassroomDetail } from '../lib/classroomsApi'
import { FormField } from './FormField'
import { Button } from './ui/Button'

interface CreateClassFormProps {
  /** Client lié au compte connecté. */
  client: ApiClient
  onCreated: (classroom: ClassroomDetail) => void
}

/** Créer une classe (compte prof). Le serveur reste juge du droit. */
export function CreateClassForm({ client, onCreated }: CreateClassFormProps) {
  const [className, setClassName] = useState('')
  const [nameError, setNameError] = useState<string | undefined>()
  const [creating, setCreating] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (creating) return
    setCreating(true)
    setNameError(undefined)
    const result = await createClassroom(client, className.trim())
    setCreating(false)
    if (result.ok) {
      setClassName('')
      onCreated(result.value)
    } else {
      setNameError(result.error.fieldErrors.name?.[0] ?? result.error.message)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
      <FormField
        label="Nom de la classe"
        type="text"
        value={className}
        onChange={setClassName}
        autoComplete="off"
        maxLength={100}
        hint="Par exemple : BUT MMI 2, groupe B."
        error={nameError}
      />
      <Button type="submit" variant="primary" loading={creating} loadingLabel="Création…" className="self-start">
        Créer la classe
      </Button>
    </form>
  )
}
