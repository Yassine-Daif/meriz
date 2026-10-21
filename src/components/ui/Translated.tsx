import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { t } from '../../i18n/runtime'
import { useLanguage } from '../../lib/useLanguage'
/** Les traductions peuvent réordonner les éléments en gardant le HTML sémantique et l'échappement React. */
export function Translated({ source, values }: { source: string; values: readonly ReactNode[] }) {
  useLanguage()
  return t(source).split(/(\{\d+\})/g).map((part, index) => {
    const slot = /^\{(\d+)\}$/.exec(part)
    return <Fragment key={index}>{slot ? values[Number(slot[1])] ?? part : part}</Fragment>
  })
}
