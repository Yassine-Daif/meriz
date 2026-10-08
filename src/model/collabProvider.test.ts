import { describe, expect, it } from 'vitest'
import { createCollabProvider } from './collabProvider'
import type { CollabEvent, CollabProvider, CollabUser } from './collabProvider'
import { createModelDoc } from './modelDoc'
import type { ModelDoc } from './modelDoc'
import { clientCommande } from './testFixtures'
import { exampleLayout } from './example'
import type { McdEditorState } from './mcdReducer'

/**
 * Deux pairs sur un bus en mémoire : c'est le filet de la co-édition.
 * Aucun réseau, aucun navigateur, donc tout se rejoue à l'identique.
 */

const ELEVE: CollabUser = {
  id: 7,
  name: 'Roy',
  firstName: 'Camille',
  role: 'student',
  avatarBg: '#e0e7ff',
  avatarFg: '#1e1b4b',
}

const PROF: CollabUser = {
  id: 3,
  name: 'Martin',
  firstName: 'Alice',
  role: 'teacher',
  avatarBg: '#fde68a',
  avatarFg: '#78350f',
}

const stateOf = (mcd: McdEditorState['mcd']): McdEditorState => ({ mcd, layout: { ...exampleLayout } })

const EMPTY: McdEditorState = { mcd: { properties: [], entities: [], associations: [] }, layout: {} }

interface Pair {
  doc: ModelDoc
  provider: CollabProvider
  me: CollabUser
}

/**
 * Un canal simulé : ce qu'un pair envoie arrive aux autres, jamais à
 * lui-même, comme le fait un évènement de client.
 */
function bus() {
  const pairs: Pair[] = []
  let muet = false
  let messages = 0

  const transportFor = (self: () => Pair) => ({
    send: (event: CollabEvent, payload: unknown) => {
      messages += 1
      if (muet) {
        return
      }
      const sender = self()
      for (const pair of pairs) {
        if (pair !== sender) {
          pair.provider.receive(event, payload)
        }
      }
    },
  })

  const add = (initial: McdEditorState, me: CollabUser, seed: boolean): Pair => {
    const doc = createModelDoc(initial, { seed })
    const pair: Pair = { doc, me, provider: null as unknown as CollabProvider }
    pair.provider = createCollabProvider({
      sync: doc.sync,
      transport: transportFor(() => pair),
      me,
    })
    pairs.push(pair)
    return pair
  }

  return {
    /** Le propriétaire, qui sème le modèle. */
    owner: (initial: McdEditorState) => add(initial, ELEVE, true),
    /** Un arrivant : document vide, rempli par la synchronisation. */
    guest: (me: CollabUser = PROF) => add(EMPTY, me, false),
    /** Un membre de groupe : document vide, qu'il peut adopter lui-même. */
    member: (me: CollabUser) => add(EMPTY, me, false),
    mute: (value: boolean) => {
      muet = value
    },
    messages: () => messages,
    remove: (pair: Pair) => {
      const index = pairs.indexOf(pair)
      if (index >= 0) pairs.splice(index, 1)
    },
  }
}

/**
 * Documents d'un groupe : personne n'est propriétaire. Chaque membre
 * naît vide et adopte le contenu du serveur si personne ne l'a fait,
 * donc deux adoptions peuvent se croiser. Rien ne doit apparaître en
 * double, et le travail déjà présent ne doit pas être effacé.
 */
describe('co-édition entre pairs d’un groupe', () => {
  it('fait converger deux membres qui adoptent le même contenu', () => {
    const canal = bus()
    const premier = canal.member(ELEVE)
    const second = canal.member(PROF)

    premier.provider.start()
    second.provider.start()
    // Le direct est en panne au moment de l'ouverture : chacun part du
    // contenu du serveur, puis les deux se parlent.
    premier.doc.adopt(stateOf(clientCommande))
    second.doc.adopt(stateOf(clientCommande))

    expect(premier.doc.snapshot()).toEqual(second.doc.snapshot())
    expect(premier.doc.snapshot().mcd.entities.map((e) => e.name)).toEqual(['Client', 'Commande'])
  })

  it('complète aussi celui qui a parlé dans le vide avant l’arrivée de l’autre', () => {
    const canal = bus()
    // Le premier démarre seul : son « hello » ne trouve personne, et
    // personne ne lui dira donc ce qu'il ignore.
    const premier = canal.member(ELEVE)
    premier.doc.adopt(stateOf(clientCommande))
    premier.provider.start()

    const second = canal.member(PROF)
    second.doc.adopt(stateOf(clientCommande))
    second.provider.start()

    // Ce que le second écrit ensuite s'appuie sur ses propres éléments :
    // sans poignée réciproque, le premier ne pourrait pas l'intégrer.
    second.doc.apply({ type: 'ADD_ENTITY', position: { x: 1, y: 2 } })

    expect(premier.doc.snapshot().mcd.entities).toHaveLength(3)
    expect(premier.doc.snapshot()).toEqual(second.doc.snapshot())
  })

  it('ne relance pas la poignée indéfiniment', () => {
    const canal = bus()
    const premier = canal.member(ELEVE)
    premier.doc.adopt(stateOf(clientCommande))
    premier.provider.start()
    const avant = canal.messages()

    const second = canal.member(PROF)
    second.provider.start()

    // Un « hello », une réponse, un complément, et c'est tout : la
    // poignée se termine, elle ne tourne pas en rond.
    expect(canal.messages() - avant).toBeLessThanOrEqual(6)
    expect(second.doc.snapshot()).toEqual(premier.doc.snapshot())
  })

  it('remplit un membre arrivé après, sans qu’il adopte', () => {
    const canal = bus()
    const premier = canal.member(ELEVE)
    premier.provider.start()
    premier.doc.adopt(stateOf(clientCommande))

    const second = canal.member(PROF)
    second.provider.start()

    expect(second.doc.snapshot()).toEqual(premier.doc.snapshot())
    expect(second.doc.snapshot().mcd.entities).toHaveLength(2)
  })

  it('garde le travail d’un membre quand un autre adopte en retard', () => {
    const canal = bus()
    const premier = canal.member(ELEVE)
    premier.provider.start()
    premier.doc.adopt(stateOf(clientCommande))
    premier.doc.apply({ type: 'RENAME_ENTITY', id: 'ent-client', name: 'Acheteur' })

    const second = canal.member(PROF)
    second.provider.start()
    // Le second a reçu le modèle : il n'adopte donc pas, et le
    // renommage du premier survit chez les deux.
    expect(second.doc.snapshot().mcd.entities.find((e) => e.id === 'ent-client')!.name).toBe('Acheteur')
    expect(second.doc.snapshot()).toEqual(premier.doc.snapshot())
  })
})

describe('co-édition, synchronisation initiale', () => {
  it('fait converger un arrivant vers l’état du propriétaire', () => {
    const canal = bus()
    const eleve = canal.owner(stateOf(clientCommande))
    const prof = canal.guest()

    expect(prof.doc.snapshot()).toEqual(EMPTY)

    eleve.provider.start()
    prof.provider.start()

    expect(prof.doc.snapshot()).toEqual(eleve.doc.snapshot())
    expect(prof.doc.snapshot().mcd.entities.map((e) => e.name)).toEqual(['Client', 'Commande'])
  })

  it('n’ajoute rien au document du propriétaire', () => {
    const canal = bus()
    const eleve = canal.owner(stateOf(clientCommande))
    const avant = eleve.doc.snapshot()
    const prof = canal.guest()

    eleve.provider.start()
    prof.provider.start()

    // Pas de doublon : l'arrivant n'a rien semé.
    expect(eleve.doc.snapshot()).toEqual(avant)
    expect(eleve.doc.snapshot().mcd.entities).toHaveLength(2)
  })

  it('ne laisse aucune étape d’annulation chez l’arrivant', () => {
    const canal = bus()
    const eleve = canal.owner(stateOf(clientCommande))
    const prof = canal.guest()

    eleve.provider.start()
    prof.provider.start()

    expect(prof.doc.canUndo()).toBe(false)
    expect(eleve.doc.canUndo()).toBe(false)
  })
})

describe('co-édition, les deux écrivent', () => {
  function duo() {
    const canal = bus()
    const eleve = canal.owner(stateOf(clientCommande))
    const prof = canal.guest()
    eleve.provider.start()
    prof.provider.start()
    return { canal, eleve, prof }
  }

  it('porte l’ajout du prof jusqu’à l’élève', () => {
    const { eleve, prof } = duo()

    prof.doc.apply({ type: 'ADD_ENTITY', position: { x: 10, y: 10 } })

    expect(eleve.doc.snapshot()).toEqual(prof.doc.snapshot())
    expect(eleve.doc.snapshot().mcd.entities).toHaveLength(3)
  })

  it('porte le renommage de l’élève jusqu’au prof', () => {
    const { eleve, prof } = duo()

    eleve.doc.apply({ type: 'RENAME_ENTITY', id: 'ent-client', name: 'Acheteur' })

    expect(prof.doc.snapshot().mcd.entities.find((e) => e.id === 'ent-client')!.name).toBe('Acheteur')
  })

  it('fusionne deux modifications croisées sans rien perdre', () => {
    const { eleve, prof } = duo()

    prof.doc.apply({ type: 'RENAME_ENTITY', id: 'ent-client', name: 'Acheteur' })
    eleve.doc.apply({ type: 'RENAME_ASSOCIATION', id: 'asso-passer', name: 'commander' })

    for (const pair of [eleve, prof]) {
      const snapshot = pair.doc.snapshot()
      expect(snapshot.mcd.entities.find((e) => e.id === 'ent-client')!.name).toBe('Acheteur')
      expect(snapshot.mcd.associations[0]!.name).toBe('commander')
    }
    expect(eleve.doc.snapshot()).toEqual(prof.doc.snapshot())
  })

  it('garde l’apport de l’autre quand on agit juste après l’avoir reçu', () => {
    const { eleve, prof } = duo()

    prof.doc.apply({ type: 'ADD_ENTITY', position: { x: 1, y: 1 } })
    // L'élève agit alors que l'entité du prof vient d'arriver : la
    // réécriture de l'état ne doit pas l'effacer.
    eleve.doc.apply({ type: 'RENAME_ENTITY', id: 'ent-commande', name: 'Achat' })

    expect(eleve.doc.snapshot().mcd.entities).toHaveLength(3)
    expect(prof.doc.snapshot().mcd.entities).toHaveLength(3)
    expect(prof.doc.snapshot().mcd.entities.find((e) => e.id === 'ent-commande')!.name).toBe('Achat')
    expect(eleve.doc.snapshot()).toEqual(prof.doc.snapshot())
  })

  it('porte aussi les déplacements', () => {
    const { eleve, prof } = duo()

    prof.doc.apply({ type: 'MOVE_NODE', id: 'ent-client', position: { x: 42, y: 24 } })

    expect(eleve.doc.snapshot().layout['ent-client']).toEqual({ x: 42, y: 24 })
  })

  it('n’annule que ses propres gestes', () => {
    const { eleve, prof } = duo()

    eleve.doc.apply({ type: 'RENAME_ENTITY', id: 'ent-client', name: 'Acheteur' })
    prof.doc.apply({ type: 'RENAME_ASSOCIATION', id: 'asso-passer', name: 'commander' })

    // Le prof n'a qu'une étape : la sienne.
    expect(prof.doc.canUndo()).toBe(true)
    prof.doc.undo()
    expect(prof.doc.canUndo()).toBe(false)

    const apres = prof.doc.snapshot()
    expect(apres.mcd.associations[0]!.name).toBe('passer')
    // Le renommage de l'élève est intact, des deux côtés.
    expect(apres.mcd.entities.find((e) => e.id === 'ent-client')!.name).toBe('Acheteur')
    expect(eleve.doc.snapshot()).toEqual(apres)
  })

  it('fait converger un troisième arrivant', () => {
    const { canal, eleve, prof } = duo()
    prof.doc.apply({ type: 'ADD_ENTITY', position: { x: 5, y: 5 } })

    const autre = canal.guest({ ...PROF, id: 9, firstName: 'Noa' })
    autre.provider.start()

    expect(autre.doc.snapshot()).toEqual(eleve.doc.snapshot())
  })
})

describe('co-édition, présence', () => {
  function duo() {
    const canal = bus()
    const eleve = canal.owner(stateOf(clientCommande))
    const prof = canal.guest()
    eleve.provider.start()
    prof.provider.start()
    return { canal, eleve, prof }
  }

  it('montre l’autre, avec son identité et son rôle', () => {
    const { eleve, prof } = duo()

    const vuParEleve = eleve.provider.others()
    expect(vuParEleve).toHaveLength(1)
    expect(vuParEleve[0]!.user).toEqual(PROF)
    expect(vuParEleve[0]!.user.role).toBe('teacher')

    expect(prof.provider.others()[0]!.user).toEqual(ELEVE)
  })

  it('porte le curseur et la sélection', () => {
    const { eleve, prof } = duo()

    prof.provider.publish({ cursor: { x: 120, y: 80 }, selection: ['ent-client'] })

    const vu = eleve.provider.others()[0]!
    expect(vu.cursor).toEqual({ x: 120, y: 80 })
    expect(vu.selection).toEqual(['ent-client'])
  })

  it('avertit à chaque changement de présence', () => {
    const { eleve, prof } = duo()
    let avis = 0
    const stop = eleve.provider.onPresence(() => {
      avis += 1
    })

    prof.provider.publish({ cursor: { x: 1, y: 2 }, selection: [] })
    expect(avis).toBeGreaterThan(0)

    stop()
    const fige = avis
    prof.provider.publish({ cursor: { x: 3, y: 4 }, selection: [] })
    expect(avis).toBe(fige)
  })

  it('efface le curseur de qui s’en va', () => {
    const { eleve, prof } = duo()
    prof.provider.publish({ cursor: { x: 10, y: 10 }, selection: [] })
    expect(eleve.provider.others()).toHaveLength(1)

    eleve.provider.forget(PROF.id)
    expect(eleve.provider.others()).toHaveLength(0)
  })

  it('efface aussi le curseur quand le pair s’arrête proprement', () => {
    const { eleve, prof } = duo()
    prof.provider.stop()
    expect(eleve.provider.others()).toHaveLength(0)
  })

  it('ne se compte jamais soi-même', () => {
    const canal = bus()
    const seul = canal.owner(stateOf(clientCommande))
    seul.provider.start()
    seul.provider.publish({ cursor: { x: 1, y: 1 }, selection: [] })

    expect(seul.provider.others()).toEqual([])
  })

  it('porte la liaison en cours de tracé', () => {
    const { eleve, prof } = duo()

    prof.provider.publish({
      cursor: { x: 50, y: 60 },
      selection: [],
      draft: { from: { x: 10, y: 20 } },
    })

    const vu = eleve.provider.others()[0]!
    expect(vu.draft).toEqual({ from: { x: 10, y: 20 } })
    // L'arrivée du trait, c'est le curseur : rien à publier de plus.
    expect(vu.cursor).toEqual({ x: 50, y: 60 })
  })

  it('sans tracé, le champ reste nul', () => {
    const { eleve, prof } = duo()

    prof.provider.publish({ cursor: { x: 1, y: 2 }, selection: [] })

    expect(eleve.provider.others()[0]!.draft).toBeNull()
  })

  it('efface le tracé au lâcher', () => {
    const { eleve, prof } = duo()
    prof.provider.publish({ cursor: { x: 5, y: 5 }, selection: [], draft: { from: { x: 0, y: 0 } } })
    expect(eleve.provider.others()[0]!.draft).not.toBeNull()

    prof.provider.publish({ cursor: { x: 5, y: 5 }, selection: [], draft: null })

    expect(eleve.provider.others()[0]!.draft).toBeNull()
  })

  it('efface le tracé de qui s’en va en pleine traînée', () => {
    const { eleve, prof } = duo()
    prof.provider.publish({ cursor: { x: 5, y: 5 }, selection: [], draft: { from: { x: 0, y: 0 } } })

    eleve.provider.forget(PROF.id)

    expect(eleve.provider.others()).toEqual([])
  })

  it('efface le tracé quand le pair s’arrête proprement', () => {
    const { eleve, prof } = duo()
    prof.provider.publish({ cursor: { x: 5, y: 5 }, selection: [], draft: { from: { x: 0, y: 0 } } })

    prof.provider.stop()

    expect(eleve.provider.others()).toEqual([])
  })

  it('ne montre jamais son propre tracé', () => {
    const canal = bus()
    const seul = canal.owner(stateOf(clientCommande))
    seul.provider.start()
    seul.provider.publish({ cursor: { x: 1, y: 1 }, selection: [], draft: { from: { x: 2, y: 2 } } })

    expect(seul.provider.others()).toEqual([])
  })
})

describe('co-édition, robustesse', () => {
  it('se tait quand on l’arrête, et ignore ce qui arrive trop tard', () => {
    const canal = bus()
    const eleve = canal.owner(stateOf(clientCommande))
    const prof = canal.guest()
    eleve.provider.start()
    prof.provider.start()

    prof.provider.stop()
    const avant = prof.doc.snapshot()
    eleve.doc.apply({ type: 'ADD_ENTITY', position: { x: 2, y: 2 } })

    expect(prof.doc.snapshot()).toEqual(avant)
  })

  it('n’envoie rien avant d’avoir démarré', () => {
    const canal = bus()
    const eleve = canal.owner(stateOf(clientCommande))
    canal.guest()

    eleve.doc.apply({ type: 'ADD_ENTITY', position: { x: 1, y: 1 } })
    expect(canal.messages()).toBe(0)
  })

  it('survit à un transport muet, sans rien casser en local', () => {
    const canal = bus()
    const eleve = canal.owner(stateOf(clientCommande))
    const prof = canal.guest()
    eleve.provider.start()
    prof.provider.start()
    canal.mute(true)

    eleve.doc.apply({ type: 'ADD_ENTITY', position: { x: 3, y: 3 } })

    expect(eleve.doc.snapshot().mcd.entities).toHaveLength(3)
    expect(prof.doc.snapshot().mcd.entities).toHaveLength(2)

    // Le lien revient : une nouvelle poignée de main rattrape le retard.
    canal.mute(false)
    prof.provider.stop()
    prof.provider.start()
    expect(prof.doc.snapshot()).toEqual(eleve.doc.snapshot())
  })

  it('ignore un message qui ne dit rien d’utile', () => {
    const canal = bus()
    const eleve = canal.owner(stateOf(clientCommande))
    eleve.provider.start()
    const avant = eleve.doc.snapshot()

    eleve.provider.receive('yjs-update', { kind: 'update' })
    eleve.provider.receive('yjs-update', null)
    eleve.provider.receive('awareness', { update: '' })
    eleve.provider.receive('autre-chose', { update: 'x' })

    expect(eleve.doc.snapshot()).toEqual(avant)
    expect(eleve.provider.others()).toEqual([])
  })

  it('ignore une présence sans identité lisible', () => {
    const canal = bus()
    const eleve = canal.owner(stateOf(clientCommande))
    const prof = canal.guest()
    eleve.provider.start()
    prof.provider.start()

    // Un pair qui publierait n'importe quoi ne doit pas être dessiné.
    prof.doc.sync.awareness.setLocalState({ user: { id: 'pas un nombre' }, cursor: null, selection: [] })
    expect(eleve.provider.others()).toEqual([])
  })

  it('ignore un tracé malformé sans jeter le reste de la présence', () => {
    const canal = bus()
    const eleve = canal.owner(stateOf(clientCommande))
    const prof = canal.guest()
    eleve.provider.start()
    prof.provider.start()

    for (const draft of ['oui', {}, { from: { x: 'ici', y: 2 } }, null]) {
      prof.doc.sync.awareness.setLocalState({
        user: PROF,
        cursor: { x: 7, y: 8 },
        selection: ['ent-client'],
        draft,
      })

      const vu = eleve.provider.others()[0]!
      expect(vu.draft).toBeNull()
      // Le reste de la présence survit à un champ illisible.
      expect(vu.user).toEqual(PROF)
      expect(vu.cursor).toEqual({ x: 7, y: 8 })
      expect(vu.selection).toEqual(['ent-client'])
    }
  })
})
