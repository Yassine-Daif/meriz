import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import { createGroup } from '../../lib/groupsApi'
import type { GroupDetail } from '../../lib/groupsApi'
import { FormField } from '../FormField'
import { Button } from '../ui/Button'

interface CreateGroupFormProps {
  /** Client lié au compte connecté. */
  client: ApiClient
  onCreated: (group: GroupDetail) => void
}

/** Créer un groupe. Celui qui le crée en devient le créateur. */
export function CreateGroupForm({ client, onCreated }: CreateGroupFormProps) {
  const [groupName, setGroupName] = useState('')
  const [nameError, setNameError] = useState<string | undefined>()
  const [creating, setCreating] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (creating) return
    setCreating(true)
    setNameError(undefined)
    const result = await createGroup(client, groupName.trim())
    setCreating(false)
    if (result.ok) {
      setGroupName('')
      onCreated(result.value)
    } else {
      setNameError(result.error.fieldErrors.name?.[0] ?? result.error.message)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
      <FormField
        label="Nom du groupe"
        type="text"
        value={groupName}
        onChange={setGroupName}
        autoComplete="off"
        maxLength={100}
        hint="Par exemple : Projet Merise, trinôme B."
        error={nameError}
      />
      <Button type="submit" variant="primary" loading={creating} loadingLabel="Création…" className="self-start">
        Créer le groupe
      </Button>
    </form>
  )
}
