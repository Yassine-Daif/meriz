import { useRef } from 'react'
import type { ChangeEvent, ReactNode } from 'react'

interface ImportFileButtonProps {
  children: ReactNode
  className: string
  onFile: (file: File) => void
}

/**
 * Bouton qui ouvre le sélecteur de fichier du système pour importer un
 * modèle Meriz. L'input natif reste caché : seul le bouton est
 * focalisable, et le même fichier peut être rouvert.
 */
export function ImportFileButton({ children, className, onFile }: ImportFileButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Réinitialisé tout de suite : permet de rouvrir le même fichier.
    event.target.value = ''
    if (file) {
      onFile(file)
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => inputRef.current?.click()}>
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleChange}
      />
    </>
  )
}
