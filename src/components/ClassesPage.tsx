import { useCallback, useState } from 'react'
import type { ApiClient } from '../lib/apiClient'
import type { ApiUser } from '../lib/authApi'
import type { ClassroomDetail } from '../lib/classroomsApi'
import { useClassrooms } from '../lib/useClassrooms'
import { ClassroomGrid } from './ClassroomGrid'
import { ClassroomView } from './ClassroomView'
import { CreateClassForm } from './CreateClassForm'
import { JoinClassForm } from './JoinClassForm'
import { PageShell } from './PageShell'
import { Card } from './ui/Card'

/** Classe à ouvrir en détail, avec son contenu s'il est déjà connu. */
export interface ClassroomOpening {
  id: string
  initial: ClassroomDetail | null
  /** Message annoncé à l'ouverture (ex. « Vous avez rejoint… »). */
  message: string | null
}

interface ClassesPageProps {
  user: ApiUser
  /** Client lié au compte connecté. */
  client: ApiClient
  /** Classe à ouvrir d'emblée (depuis l'accueil). */
  opening?: ClassroomOpening | null
}

/**
 * Mes classes : rejoindre par code, et, pour un compte prof, créer une
 * classe. Une classe choisie s'ouvre en détail. Rien n'est gardé dans le
 * navigateur : tout est relu auprès du serveur pour le compte connecté.
 */
export function ClassesPage({ user, client, opening = null }: ClassesPageProps) {
  const classrooms = useClassrooms(client)
  const { reload } = classrooms
  const [selected, setSelected] = useState<ClassroomOpening | null>(opening)
  const [status, setStatus] = useState<string | null>(null)

  const canCreate = user.role === 'teacher'

  const open = (next: ClassroomOpening) => {
    setSelected(next)
    void reload()
  }

  const backToList = useCallback(
    (message: string | null) => {
      setSelected(null)
      setStatus(message)
      void reload()
    },
    [reload],
  )

  if (selected) {
    return (
      <PageShell title="Classe" focusKey={selected.id} onBack={() => backToList(null)} backLabel="Retour à mes classes">
        <ClassroomView
          key={selected.id}
          client={client}
          classroomId={selected.id}
          initial={selected.initial}
          onGone={(message) => backToList(message)}
          initialStatus={selected.message}
        />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Mes classes"
      description={
        canCreate
          ? 'Créez une classe et partagez son code, ou rejoignez celle d’un collègue.'
          : 'Rejoignez une classe avec le code donné par votre prof.'
      }
    >
      <p role="status" aria-live="polite" className="min-h-5 text-sm">
        {status && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-3 py-1 text-ink">
            <span aria-hidden="true" className="text-sage">
              ✓
            </span>
            {status}
          </span>
        )}
      </p>

      <div className={`mt-3 grid gap-4 ${canCreate ? 'md:grid-cols-2' : 'md:max-w-md'}`}>
        <Card as="section" aria-labelledby="rejoindre-titre">
          <h2 id="rejoindre-titre" className="text-base font-semibold text-ink">
            Rejoindre une classe
          </h2>
          <div className="mt-3">
            <JoinClassForm
              client={client}
              onJoined={(classroom) =>
                open({ id: classroom.id, initial: classroom, message: `Vous avez rejoint la classe « ${classroom.name} ».` })
              }
            />
          </div>
        </Card>

        {canCreate && (
          <Card as="section" aria-labelledby="creer-titre">
            <h2 id="creer-titre" className="text-base font-semibold text-ink">
              Créer une classe
            </h2>
            <div className="mt-3">
              <CreateClassForm
                client={client}
                onCreated={(classroom) =>
                  open({
                    id: classroom.id,
                    initial: classroom,
                    message: `Classe « ${classroom.name} » créée. Partagez son code à vos élèves.`,
                  })
                }
              />
            </div>
          </Card>
        )}
      </div>

      <section aria-labelledby="liste-titre" className="mt-8">
        <h2 id="liste-titre" className="text-lg font-semibold tracking-tight text-ink">
          Vos classes
          {classrooms.classrooms && classrooms.classrooms.length > 0 && (
            <span className="font-normal text-ink-soft"> ({classrooms.classrooms.length})</span>
          )}
        </h2>
        <div className="mt-3">
          <ClassroomGrid
            state={classrooms}
            onOpen={(classroom) => setSelected({ id: classroom.id, initial: null, message: null })}
            emptyText={
              canCreate
                ? 'Aucune classe pour l’instant : créez-en une, ou rejoignez celle d’un collègue.'
                : 'Aucune classe pour l’instant : saisissez le code donné par votre prof.'
            }
          />
        </div>
      </section>
    </PageShell>
  )
}
