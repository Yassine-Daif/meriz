import { Children, Fragment, isValidElement } from 'react'
import type { OptionHTMLAttributes, ReactNode } from 'react'

export interface SelectOption { kind: 'option'; value: string; label: ReactNode; text: string; disabled: boolean; lang?: string }
export interface SelectGroup { kind: 'group'; label: string; options: SelectOption[] }
export type SelectEntry = SelectOption | SelectGroup

function plainText(children: ReactNode): string {
  return Children.toArray(children).map(child => isValidElement<{ children?: ReactNode }>(child) ? plainText(child.props.children) : typeof child === 'string' || typeof child === 'number' ? String(child) : '').join('')
}

/** Conserve les valeurs, les libellés et les groupes des anciens sélecteurs. */
export function selectEntries(children: ReactNode, inheritedDisabled = false): SelectEntry[] {
  const entries: SelectEntry[] = []
  Children.forEach(children, child => {
    if (!isValidElement<OptionHTMLAttributes<HTMLOptionElement>>(child)) return
    const props = child.props
    if (child.type === Fragment) entries.push(...selectEntries(props.children, inheritedDisabled))
    else if (child.type === 'optgroup') entries.push({
      kind: 'group', label: props.label ?? '',
      options: selectEntries(props.children, inheritedDisabled || !!props.disabled).flatMap(entry => entry.kind === 'option' ? [entry] : entry.options),
    })
    else if (child.type === 'option') entries.push({
      kind: 'option', value: String(props.value ?? plainText(props.children)),
      label: props.children, text: plainText(props.children), disabled: inheritedDisabled || !!props.disabled,
      lang: props.lang,
    })
  })
  return entries
}
