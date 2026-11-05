import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiClient } from '../lib/apiClient'
import { parseApiUser } from '../lib/authApi'
import type { ApiUser } from '../lib/authApi'
import { t } from '../i18n/runtime'
import { useLanguage } from '../lib/useLanguage'
import { useSession } from './sessionContext'
import { ResendVerification } from './ResendVerification'
import { Button } from './ui/Button'
import { Select } from './ui/Select'
import { useToast } from './ui/toastContext'

interface Institution { id: string; name: string }
export function TeacherModeSection({ user, client, onShowClasses }: { user: ApiUser; client: ApiClient; onShowClasses: () => void }) {
  useLanguage()
  const { updateUser } = useSession(), toast = useToast()
  const [token, setToken] = useState(''), [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null)
  const [institutions, setInstitutions] = useState<Institution[]>([]), [institution, setInstitution] = useState(''), [email, setEmail] = useState('')
  useEffect(() => {
    let active = true
    void client.request('GET', '/me/education').then(result => {
      if (!active || !result.ok || !result.data || typeof result.data !== 'object' || !('referent_institutions' in result.data) || !Array.isArray(result.data.referent_institutions)) return
      const values = result.data.referent_institutions.filter((v): v is Institution => !!v && typeof v === 'object' && typeof v.id === 'string' && typeof v.name === 'string')
      setInstitutions(values); setInstitution(values[0]?.id ?? '')
    })
    return () => { active = false }
  }, [client])
  async function accept(event: FormEvent) {
    event.preventDefault(); if (pending) return
    setPending(true); setError(null)
    try {
      const result = await client.request('POST', '/me/education/accept-invitation', { token: token.trim() })
      if (!result.ok) { setError(result.error.fieldErrors.token?.[0] ?? result.error.message); return }
      const next = parseApiUser(result.data)
      if (!next) { setError(t('Réponse inattendue du serveur. Réessayez plus tard.')); return }
      updateUser(next); setToken('')
      toast(t(next.role === 'teacher' ? 'Votre espace professeur est activé.' : 'Votre statut est confirmé. Vérifiez votre email pour activer votre espace professeur.'))
    } finally { setPending(false) }
  }
  async function invite(event: FormEvent) {
    event.preventDefault(); if (pending) return
    setPending(true)
    try {
      const result = await client.request('POST', '/me/education/invitations', { institution_id: institution, email: email.trim() })
      if (result.ok) { setEmail(''); toast(t('Invitation envoyée.')) } else toast({ kind: 'error', text: result.error.message })
    } finally { setPending(false) }
  }
  const offerTeacher = user.role === 'teacher' || user.usageCategory === 'teacher'
  if (!offerTeacher && institutions.length === 0) return null
  return <section className="mt-6 space-y-4 rounded-card border border-line bg-surface p-5 sm:p-6" aria-labelledby="education-status-title">
    <h2 id="education-status-title" className="text-lg font-semibold">{t(offerTeacher ? user.role === 'teacher' ? 'Espace professeur' : 'Activer mon espace professeur' : 'Référent d’établissement')}</h2>
    {offerTeacher && (user.role === 'teacher' ? <><p className="text-sm text-ink-soft">{t('Votre espace professeur est actif. Vos classes et documents restent accessibles.')}</p><Button onClick={onShowClasses}>{t('Aller à mes classes')}</Button></> : <>
      <p className="text-sm text-ink-soft">{t('La confirmation de votre email vérifie votre boîte de réception. Le rôle professeur demande aussi une confirmation de votre statut par l’établissement.')}</p>
      {user.isAcademic && <p className="text-sm text-ink-soft">{t('Votre domaine scolaire est reconnu. Il ne permet pas à lui seul de distinguer un élève d’un professeur.')}</p>}
      <p className="text-sm text-ink-soft">{t('Vous pouvez conserver votre adresse personnelle comme contact. Les connexions aux établissements seront proposées lorsqu’elles seront raccordées à Meriz.')}</p>
      {user.emailVerifiedAt === null && <ResendVerification client={client} label={t('Confirmer mon adresse email')} />}
      {user.teacherVerifiedAt ? <p role="status" className="text-sm">{t('Votre statut est confirmé. Vérifiez votre email pour activer votre espace professeur.')}</p> : <form onSubmit={event => void accept(event)} className="space-y-3">
        <label className="flex min-w-0 flex-col gap-1 text-sm">{t('Code d’invitation de votre établissement')}<input value={token} onChange={e => setToken(e.target.value)} required minLength={64} maxLength={64} autoComplete="off" spellCheck={false} className="min-w-0 rounded-control border border-line-strong bg-surface px-3 py-2 font-mono" /></label>
        <p className="text-xs text-ink-soft">{t('Si votre établissement dispose d’un référent vérifié dans Meriz, celui-ci peut vous adresser une invitation nominative. Sans invitation, vous pouvez continuer à utiliser l’éditeur.')}</p>
        <Button variant="primary" type="submit" loading={pending}>{t('Valider mon statut professeur')}</Button>
      </form>}
    </>)}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {institutions.length > 0 && <form onSubmit={event => void invite(event)} className="space-y-3 border-t border-line pt-4">
      <h3 className="font-semibold">{t('Référent : inviter un professeur')}</h3>
      <p className="text-xs text-ink-soft">{t('Invitez uniquement les enseignants dont vous avez confirmé le statut dans votre établissement.')}</p>
      <label className="flex min-w-0 flex-col gap-1 text-sm">{t('Établissement')}<Select value={institution} disabled={pending} onValueChange={setInstitution}>{institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</Select></label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">{t('Email du professeur')}<input type="email" required maxLength={255} value={email} onChange={e => setEmail(e.target.value)} className="min-w-0 rounded-control border border-line-strong bg-surface px-3 py-2" /></label>
      <Button type="submit" loading={pending}>{t('Envoyer l’invitation')}</Button>
    </form>}
  </section>
}
