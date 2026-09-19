import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiClient } from '../lib/apiClient'
import { joinClassroom, normalizeJoinCode } from '../lib/classroomsApi'
import type { ClassroomDetail } from '../lib/classroomsApi'
import { FormField } from './FormField'
import { Button } from './ui/Button'

interface JoinClassFormProps {
  /** Client lié au compte connecté. */
  client: ApiClient
  onJoined: (classroom: ClassroomDetail) => void
}

/** Rejoindre une classe avec le code donné par le prof. */
export function JoinClassForm({ client, onJoined }: JoinClassFormProps) {
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>()
  const [joining, setJoining] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (joining) return
    const normalized = normalizeJoinCode(code)
    if (normalized.length === 0) {
      setCodeError('Saisissez le code donné par votre prof.')
      codeRef.current?.focus()
      return
    }
    setJoining(true)
    setCodeError(undefined)
    const result = await joinClassroom(client, code)
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
        label="Code de la classe"
        type="text"
        value={code}
        onChange={setCode}
        autoComplete="off"
        maxLength={20}
        mono
        hint="8 caractères donnés par votre prof. Minuscules, espaces et tirets acceptés."
        error={codeError}
        inputRef={codeRef}
      />
      <Button type="submit" variant="primary" loading={joining} loadingLabel="Vérification…" className="self-start">
        Rejoindre
      </Button>
    </form>
  )
}
