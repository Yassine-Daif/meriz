import type { ClassroomSummary } from '../../lib/classroomsApi'
import type { GroupSummary } from '../../lib/groupsApi'
import { Card } from '../ui/Card'

/** Ce qu'on garde sous la main : la liste entière vit sur sa page. */
const SHOWN = 3

interface QuickAccessProps {
  classrooms: ClassroomSummary[] | null
  groups: GroupSummary[] | null
  onOpenClassroom: (id: string) => void
  onOpenGroup: (id: string) => void
  onShowClasses: () => void
  onShowGroups: () => void
  /** Ce qu'on propose quand il n'y a aucune classe, selon le rôle. */
  emptyClassesText: string
}

function Entry({ name, detail, onOpen, label }: { name: string; detail: string; onOpen: () => void; label: string }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        className="flex w-full items-baseline justify-between gap-2 rounded-control px-2 py-1.5 text-left transition-colors duration-150 hover:bg-accent-soft"
      >
        <span className="min-w-0 truncate text-sm font-medium text-ink">{name}</span>
        <span className="shrink-0 text-xs text-ink-soft">{detail}</span>
      </button>
    </li>
  )
}

function membersDetail(count: number | null): string {
  if (count === null) return ''
  return count > 1 ? `${count} membres` : `${count} membre`
}

/**
 * Les trois dernières classes et les trois derniers groupes, à portée de
 * clic. Ce n'est pas la liste : elle vit sur Mes classes et Mes groupes,
 * où une recherche permet de s'y retrouver quand il y en a beaucoup.
 */
export function QuickAccess({
  classrooms,
  groups,
  onOpenClassroom,
  onOpenGroup,
  onShowClasses,
  onShowGroups,
  emptyClassesText,
}: QuickAccessProps) {
  const linkClass = 'rounded-control text-sm font-medium text-accent-ink underline underline-offset-2'

  return (
    <Card as="section" aria-labelledby="acces-titre">
      <h2 id="acces-titre" className="text-base font-semibold text-ink">
        Accès rapide
      </h2>

      <div className="mt-3">
        <h3 className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Classes</h3>
        {classrooms === null ? (
          <p role="status" className="mt-1.5 text-sm text-ink-soft">
            Chargement de vos classes…
          </p>
        ) : classrooms.length === 0 ? (
          <p className="mt-1.5 text-sm text-ink-soft">{emptyClassesText}</p>
        ) : (
          <ul className="mt-1.5 -mx-2 flex flex-col">
            {classrooms.slice(0, SHOWN).map((classroom) => (
              <Entry
                key={classroom.id}
                name={classroom.name}
                detail={membersDetail(classroom.membersCount)}
                onOpen={() => onOpenClassroom(classroom.id)}
                label={`Ouvrir la classe ${classroom.name}`}
              />
            ))}
          </ul>
        )}
        <button type="button" onClick={onShowClasses} className={`mt-2 ${linkClass}`}>
          Voir toutes mes classes
        </button>
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Groupes</h3>
        {groups === null ? (
          <p role="status" className="mt-1.5 text-sm text-ink-soft">
            Chargement de vos groupes…
          </p>
        ) : groups.length === 0 ? (
          <p className="mt-1.5 text-sm text-ink-soft">
            Aucun groupe pour l’instant. Créez-en un pour travailler à plusieurs sur les mêmes modèles.
          </p>
        ) : (
          <ul className="mt-1.5 -mx-2 flex flex-col">
            {groups.slice(0, SHOWN).map((group) => (
              <Entry
                key={group.id}
                name={group.name}
                detail={membersDetail(group.membersCount)}
                onOpen={() => onOpenGroup(group.id)}
                label={`Ouvrir le groupe ${group.name}`}
              />
            ))}
          </ul>
        )}
        <button type="button" onClick={onShowGroups} className={`mt-2 ${linkClass}`}>
          Voir tous mes groupes
        </button>
      </div>
    </Card>
  )
}
