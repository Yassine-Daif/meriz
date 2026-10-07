import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import { normalizeJoinCode } from '../../lib/classroomsApi'
import { joinGroup } from '../../lib/groupsApi'
import type { GroupDetail } from '../../lib/groupsApi'
import { FormField } from '../FormField'
import { Button } from '../ui/Button'

interface JoinGroupFormProps {
  /** Client lié au compte connecté. */
  client: ApiClient
  onJoined: (group: GroupDetail) => void
}

/** Rejoindre un groupe avec le code donné par un de ses membres. */
export function JoinGroupForm({ client, onJoined }: JoinGroupFormProps) {
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>()
  const [joining, setJoining] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (joining) return
    if (normalizeJoinCode(code).length === 0) {
      setCodeError('Saisissez le code du groupe.')
      codeRef.current?.focus()
      return
    }
    setJoining(true)
    setCodeError(undefined)
    const result = await joinGroup(client, code)
    setJoining(false)
    if (result.ok) {
      setCode('')
      onJoined(result.value)
    } else {
      setCodeError(result.error.fieldErrors.code?.[0] ?? result.error.message)
      codeRef.current?.focus()
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
      <FormField
        label="Code du groupe"
        type="text"
        value={code}
        onChange={setCode}
        autoComplete="off"
        maxLength={20}
        mono
        hint="8 caractères donnés par un membre. Minuscules, espaces et tirets acceptés."
        error={codeError}
        inputRef={codeRef}
      />
      <Button type="submit" variant="primary" loading={joining} loadingLabel="Vérification…" className="self-start">
        Rejoindre
      </Button>
    </form>
  )
}
