import { useCallback, useState } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import { formatJoinCode } from '../../lib/classroomsApi'
import { copyText } from '../../lib/clipboard'
import type { GroupDetail } from '../../lib/groupsApi'
import { useGroups } from '../../lib/useGroups'
import { PageShell } from '../PageShell'
import { Card } from '../ui/Card'
import { CreateGroupForm } from './CreateGroupForm'
import type { OpenGroupDocument } from './GroupDocumentsPanel'
import { GroupGrid } from './GroupGrid'
import { GroupView } from './GroupView'
import type { GroupTab } from './GroupView'
import { JoinGroupForm } from './JoinGroupForm'

/** Ce qu'il faut pour rouvrir un groupe, au retour de l'outil MCD. */
export interface GroupOpening {
  id: string
  /** Groupe déjà connu, affiché sans attendre le serveur. */
  initial: GroupDetail | null
  message: string | null
  tab?: GroupTab | null
}

interface GroupsPageProps {
  client: ApiClient
  opening?: GroupOpening | null
  onOpenGroupDocument: OpenGroupDocument
}

/**
 * Mes groupes : en créer un, en rejoindre un par code, et ouvrir ceux
 * dont je fais partie. C'est entre élèves, sans prof ni note : chacun
 * travaille avec les autres sur les documents du groupe.
 */
export function GroupsPage({ client, opening = null, onOpenGroupDocument }: GroupsPageProps) {
  const groups = useGroups(client)
  const { reload } = groups
  const [selected, setSelected] = useState<GroupOpening | null>(opening)
  const [status, setStatus] = useState<string | null>(null)

  const open = (next: GroupOpening) => {
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

  const copyCode = async (code: string) => {
    const copied = await copyText(formatJoinCode(code))
    setStatus(
      copied
        ? `Code ${formatJoinCode(code)} copié dans le presse-papiers.`
        : 'Copie impossible dans ce navigateur : ouvrez le groupe pour lire son code.',
    )
  }

  if (selected) {
    return (
      <PageShell title="Groupe" focusKey={selected.id} onBack={() => backToList(null)} backLabel="Retour à mes groupes">
        <GroupView
          key={selected.id}
          client={client}
          groupId={selected.id}
          initial={selected.initial}
          initialStatus={selected.message}
          openTab={selected.tab ?? null}
          onGone={(message) => backToList(message)}
          onOpenGroupDocument={onOpenGroupDocument}
        />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Mes groupes"
      description="Travaillez à plusieurs sur les mêmes modèles. Créez un groupe et partagez son code, ou rejoignez celui d’un camarade."
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

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <Card as="section" aria-labelledby="rejoindre-groupe-titre">
          <h2 id="rejoindre-groupe-titre" className="text-base font-semibold text-ink">
            Rejoindre un groupe
          </h2>
          <div className="mt-3">
            <JoinGroupForm
              client={client}
              onJoined={(group) =>
                open({
                  id: group.id,
                  initial: group,
                  message: `Vous avez rejoint le groupe « ${group.name} ».`,
                })
              }
            />
          </div>
        </Card>

        <Card as="section" aria-labelledby="creer-groupe-titre">
          <h2 id="creer-groupe-titre" className="text-base font-semibold text-ink">
            Créer un groupe
          </h2>
          <div className="mt-3">
            <CreateGroupForm
              client={client}
              onCreated={(group) =>
                open({
                  id: group.id,
                  initial: group,
                  message: `Groupe « ${group.name} » créé. Partagez son code pour que les autres vous rejoignent.`,
                })
              }
            />
          </div>
        </Card>
      </div>

      <section aria-labelledby="liste-groupes-titre" className="mt-8">
        <h2 id="liste-groupes-titre" className="text-lg font-semibold tracking-tight text-ink">
          Vos groupes
          {groups.groups && groups.groups.length > 0 && (
            <span className="font-normal text-ink-soft"> ({groups.groups.length})</span>
          )}
        </h2>
        <div className="mt-3">
          <GroupGrid
            state={groups}
            onOpen={(group) => setSelected({ id: group.id, initial: null, message: null })}
            onCopyCode={(code) => void copyCode(code)}
            emptyText="Aucun groupe pour l’instant : créez-en un, ou saisissez le code d’un camarade."
          />
        </div>
      </section>
    </PageShell>
  )
}
