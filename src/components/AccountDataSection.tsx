import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
import { useState } from 'react'
import type { ApiClient } from '../lib/apiClient'
import type { ApiUser } from '../lib/authApi'
import { exportAccountData, exportFileName } from '../lib/accountApi'
import { saveFileAs } from '../lib/download'
import { DeleteAccountDialog } from './DeleteAccountDialog'
import { Button } from './ui/Button'
import { Notice } from './ui/Notice'

interface AccountDataSectionProps {
  user: ApiUser
  /** Client lié au compte connecté : les deux gestes valent pour soi seul. */
  client: ApiClient
  /** Compte supprimé : l'application revient à l'accueil public. */
  onDeleted: () => void
}

/**
 * Emporter ses données, et fermer son compte.
 *
 * Les deux gestes vivent hors du formulaire de profil : l'un télécharge
 * un fichier, l'autre est définitif, et ni l'un ni l'autre n'a affaire
 * avec l'enregistrement des champs.
 */
export function AccountDataSection({ user, client, onDeleted }: AccountDataSectionProps) {
  useLanguage()
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const download = async () => {
    if (pending) return
    setPending(true)
    setStatus('')
    setError(null)
    const outcome = await exportAccountData(client)
    if (!outcome.ok) {
      setError(outcome.error.message)
      setPending(false)
      return
    }
    const result = await saveFileAs(exportFileName(new Date()), outcome.value, t("Données Meriz"), {
      'application/json': ['.json'],
    })
    setPending(false)
    if (result === 'cancelled') {
      setStatus(t("Enregistrement annulé."))
    } else {
      setStatus(t("Fichier enregistré."))
    }
  }

  return (
    <section
      aria-labelledby="donnees-titre"
      className="mt-6 rounded-card border border-line bg-surface p-5 shadow-soft sm:p-6"
    >
      <h2 id="donnees-titre" className="text-lg font-semibold tracking-tight text-ink">
        {t("Mes données")}</h2>

      <p className="mt-2 text-sm leading-6 text-ink-soft">
        {t("Le fichier rassemble tout ce qui vous appartient et rien des autres : votre compte, vos documents, vos classes et vos groupes, vos rendus, vos commentaires, et pour un prof ses devoirs et ses cours. C'est du JSON, lisible tel quel. Les fichiers envoyés n'y sont pas copiés : chacun y figure avec son adresse de téléchargement.")}</p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void download()} loading={pending} loadingLabel={t("Préparation…")}>
          {t("Télécharger mes données")}</Button>
        <p role="status" aria-live="polite" className="text-sm text-ink-soft">
          {status && (
            <>
              <span aria-hidden="true">✓ </span>
              {status}
            </>
          )}
        </p>
      </div>

      {error !== null && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <h3 className="text-sm font-semibold text-ink">{t("Supprimer mon compte")}</h3>
        <p className="mt-1 text-sm leading-6 text-ink-soft">
          {t("La suppression est définitive. Pensez à télécharger vos données avant, si vous voulez les garder.")}</p>
        <div className="mt-3">
          <Button type="button" variant="danger" onClick={() => setConfirming(true)}>
            {t("Supprimer mon compte")}</Button>
        </div>
      </div>

      <DeleteAccountDialog
        open={confirming}
        user={user}
        onCancel={() => setConfirming(false)}
        onDeleted={() => {
          setConfirming(false)
          onDeleted()
        }}
      />
    </section>
  )
}
