import * as Primitive from '@radix-ui/react-select'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { selectEntries } from './selectOptions'
import type { SelectOption } from './selectOptions'

interface SelectProps extends Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'value' | 'onChange'> {
  children: ReactNode
  value: string
  onValueChange: (value: string) => void
}
// Radix réserve la chaîne vide au placeholder ; les données Meriz gardent leurs valeurs.
const encode = (value: string) => 'choice:' + value

/** Même présentation en clair/sombre, y compris dans les fenêtres <dialog>. */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select({
  children, value, onValueChange, disabled, className = '', title, onKeyDown, ...props
}, forwardedRef) {
  const trigger = useRef<HTMLButtonElement>(null)
  useImperativeHandle(forwardedRef, () => trigger.current!)
  const [open, setOpen] = useState(false)
  const [container, setContainer] = useState<HTMLElement | null>(null)
  useEffect(() => { if (disabled) setOpen(false) }, [disabled])
  const entries = selectEntries(children)
  const selected = entries.flatMap(entry => entry.kind === 'option' ? [entry] : entry.options).find(option => option.value === value)
  const option = (item: SelectOption) => <Primitive.Item key={item.value} value={encode(item.value)} data-value={item.value} disabled={item.disabled} textValue={item.text} lang={item.lang} className="meriz-select-option">
    <Primitive.ItemIndicator className="meriz-select-indicator"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg></Primitive.ItemIndicator>
    <Primitive.ItemText><span className="meriz-select-option-text">{item.label}</span></Primitive.ItemText>
  </Primitive.Item>
  return <Primitive.Root value={encode(value)} onValueChange={next => { if (!disabled) onValueChange(next.slice(7)) }} disabled={disabled} open={open}
    onOpenChange={next => {
      if (next && disabled) return
      if (next) setContainer(trigger.current?.closest('dialog[open]') ?? null)
      setOpen(next)
    }}>
    <Primitive.Trigger {...props} type="button" data-value={value} ref={trigger} title={title ?? selected?.text} className={'meriz-select-trigger ' + className}
      onKeyDown={event => {
        onKeyDown?.(event)
        // Les touches de sélection ne doivent pas piloter le canevas derrière le menu.
        if (!((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase()))) event.stopPropagation()
      }}>
      <span className="meriz-select-value"><Primitive.Value>{selected?.label}</Primitive.Value></span>
      <Primitive.Icon asChild><svg className="meriz-select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></Primitive.Icon>
    </Primitive.Trigger>
    <Primitive.Portal container={container}>
      <Primitive.Content className="meriz-select-content" position="popper" sideOffset={5} collisionPadding={12}
        onKeyDown={event => event.stopPropagation()} onEscapeKeyDown={event => event.stopPropagation()}>
        <Primitive.ScrollUpButton className="meriz-select-scroll" aria-hidden="true">⌃</Primitive.ScrollUpButton>
        <Primitive.Viewport className="meriz-select-viewport">
          {entries.map((entry, index) => entry.kind === 'option' ? option(entry) :
            <Primitive.Group key={'group:' + index}><Primitive.Label className="meriz-select-group">{entry.label}</Primitive.Label>{entry.options.map(option)}</Primitive.Group>)}
        </Primitive.Viewport>
        <Primitive.ScrollDownButton className="meriz-select-scroll" aria-hidden="true">⌄</Primitive.ScrollDownButton>
      </Primitive.Content>
    </Primitive.Portal>
  </Primitive.Root>
})
