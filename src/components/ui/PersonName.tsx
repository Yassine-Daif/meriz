import { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { displayName } from '../../lib/authApi'
import { t } from '../../i18n/runtime'
import { useLanguage } from '../../lib/useLanguage'
import { dialogClass } from './dialogClass'
import { Button } from './Button'

/** Valeur complète conservée ; seule sa présentation est raccourcie. */
export function PersonName({ person, className = '' }: { person: { firstName: string | null; name: string }; className?: string }) {
  useLanguage()
  const dialog = useRef<HTMLDialogElement>(null), titleId = useId()
  const name = displayName(person)
  if ([...name].length <= 28) return <span className={'min-w-0 max-w-full truncate ' + className} title={name}>{name}</span>
  return <>
    <button type="button" className={'inline-block min-w-0 max-w-full truncate text-left align-bottom underline decoration-dotted underline-offset-2 ' + className} title={t('Afficher le nom complet')} aria-label={t('Afficher le nom complet de {0}', [name])} onClick={() => dialog.current?.showModal()}>{name}</button>
    {typeof document !== 'undefined' && createPortal(<dialog ref={dialog} aria-labelledby={titleId} className={dialogClass('sm')}><div className="space-y-4 p-5"><h2 id={titleId} className="text-lg font-semibold">{t('Nom complet')}</h2><p className="text-sm [overflow-wrap:anywhere]">{name}</p><Button onClick={() => dialog.current?.close()}>{t('Fermer')}</Button></div></dialog>, document.body)}
  </>
}
