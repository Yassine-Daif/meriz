import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import type { Association, AttributeType, Cardinality, Entity, Leg, Mcd, Property, PropertyRef } from './mcd'
import type { McdLayout, Position } from './layout'
import type { McdAction, McdEditorState } from './mcdReducer'
import { mcdReducer } from './mcdReducer'

/**
 * Le modèle porté par un document Yjs, un CRDT. C'est la source de
 * vérité de l'éditeur, et le socle de l'édition à plusieurs : cette
 * étape reste locale, le réseau viendra ensuite.
 *
 * Deux règles tiennent tout le fichier.
 *
 * D'abord, le reste de l'application ne voit jamais Yjs : `snapshot()`
 * rend un `McdEditorState` d'objets JS ordinaires, reconstruit dans un
 * ordre de champs fixe. La validation, le MLD, le MPD, le SQL, le
 * dictionnaire et la persistance continuent donc de travailler comme
 * avant, et un même contenu se sérialise toujours à l'identique.
 *
 * Ensuite, la logique métier n'est pas réécrite : `mcdReducer` calcule
 * l'état suivant, et la réconciliation ci-dessous l'inscrit dans le
 * document, identifiant par identifiant, en ne touchant que ce qui a
 * changé. Les écritures restent donc fines, ce qui fera de bonnes
 * fusions quand deux personnes travailleront ensemble.
 */

/** Origine des écritures de l'utilisateur : seules celles-là s'annulent. */
const LOCAL_ORIGIN = 'meriz-local'
/** Origine d'un instantané venu d'ailleurs : rien à annuler. */
const ADOPT_ORIGIN = 'meriz-adopt'
/** Origine d'une mise à jour reçue d'un pair : rien à annuler non plus. */
const REMOTE_ORIGIN = 'meriz-remote'

/** Profondeur d'historique, comme avant Yjs. */
const HISTORY_LIMIT = 100

/**
 * Yjs fusionne deux transactions suivies si elles se touchent dans ce
 * délai. On le met hors de portée, parce que le découpage des étapes
 * n'est pas une affaire de temps ici : il suit la cible de l'action,
 * et c'est `stopCapturing()` qui tranche.
 */
const MERGE_WINDOW_MS = Number.MAX_SAFE_INTEGER

/** Réglages à la création du document. */
export interface ModelDocOptions {
  /**
   * Faux : le document naît vide, prêt à recevoir la synchronisation
   * d'un pair. Vrai par défaut, l'état fourni est inscrit.
   */
  seed?: boolean
}

/**
 * Branchement du réseau. Le fournisseur de co-édition est le seul à
 * toucher à ces fils : le reste de l'application ne voit toujours que
 * des objets JS ordinaires.
 */
export interface ModelSync {
  /** Ce que nous avons déjà, pour qu'un pair n'envoie que le manque. */
  stateVector: () => Uint8Array
  /** Ce qui manque à qui nous a envoyé son vecteur. */
  diffSince: (vector: Uint8Array) => Uint8Array
  /** Mise à jour reçue : appliquée hors de l'historique local. */
  applyRemote: (update: Uint8Array) => void
  /** Chaque écriture locale, binaire, à diffuser telle quelle. */
  onLocalUpdate: (listener: (update: Uint8Array) => void) => () => void
  /** Présence Yjs : curseurs et sélections des participants. */
  awareness: Awareness
}

export interface ModelDoc {
  /** Le modèle en objets JS ordinaires, mis en cache entre deux changements. */
  snapshot: () => McdEditorState
  apply: (action: McdAction) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  /** Instantané venu d'ailleurs (observation en direct) : rien à annuler. */
  adopt: (state: McdEditorState) => void
  subscribe: (listener: () => void) => () => void
  /** Branchement du réseau, pour le fournisseur de co-édition. */
  sync: ModelSync
  destroy: () => void
}

/* ------------------------------------------------------------------ */
/* Lecture : du document vers des objets JS ordinaires                */

/*
 * L'ordre des champs est écrit à la main, et il suit celui des types de
 * `mcd.ts`. C'est ce qui rend la sérialisation déterministe, donc les
 * dédoublonnages de sauvegarde fiables. Un champ optionnel vide est
 * absent, jamais nul : la relecture d'un fichier l'exige.
 */

type YNode = Y.Map<unknown>

/**
 * Deux pairs qui ensemencent le même contenu avant de s'être parlé
 * insèrent chacun leurs éléments, et la fusion d'un CRDT de séquence
 * garde les deux. Le cas arrive sur un document de groupe, où personne
 * n'est propriétaire, par exemple quand le direct est en panne et que
 * chacun part du contenu du serveur.
 *
 * On ne supprime rien : effacer dépendrait de l'ordre vu au moment de
 * décider, et deux pairs pressés effaceraient des copies différentes,
 * donc tout. On lit seulement la première occurrence de chaque
 * identifiant, et l'écriture suit la même règle. Les copies en trop
 * restent invisibles, elles ne sont ni affichées ni enregistrées, et
 * elles disparaissent avec la session.
 */
function firstOfEachId(list: Y.Array<YNode>): YNode[] {
  const seen = new Set<string>()
  const nodes: YNode[] = []
  for (const node of list) {
    const id = node.get('id') as string
    if (!seen.has(id)) {
      seen.add(id)
      nodes.push(node)
    }
  }
  return nodes
}

function readProperty(node: YNode): Property {
  const property: Property = {
    id: node.get('id') as string,
    name: node.get('name') as string,
    type: node.get('type') as AttributeType,
  }
  const size = node.get('size')
  if (typeof size === 'number') {
    property.size = size
  }
  return property
}

function readRef(node: YNode): PropertyRef {
  return { propertyId: node.get('propertyId') as string, isIdentifier: node.get('isIdentifier') === true }
}

/*
 * Les références de propriétés portent aussi leur `propertyId` sous
 * `id` (voir REF_SHAPE), donc `firstOfEachId` les dédoublonne comme le
 * reste.
 */

function readRefs(node: YNode): PropertyRef[] {
  return firstOfEachId(node.get('attributes') as Y.Array<YNode>).map(readRef)
}

function readCardinality(node: YNode): Cardinality {
  const raw = node.get('cardinality') as Cardinality
  return { min: raw.min, max: raw.max }
}

function readLeg(node: YNode): Leg {
  const leg: Leg = {
    id: node.get('id') as string,
    entityId: node.get('entityId') as string,
    cardinality: readCardinality(node),
  }
  const role = node.get('role')
  if (typeof role === 'string') {
    leg.role = role
  }
  return leg
}

function readEntity(node: YNode): Entity {
  return { id: node.get('id') as string, name: node.get('name') as string, attributes: readRefs(node) }
}

function readAssociation(node: YNode): Association {
  return {
    id: node.get('id') as string,
    name: node.get('name') as string,
    attributes: readRefs(node),
    legs: firstOfEachId(node.get('legs') as Y.Array<YNode>).map(readLeg),
  }
}

/** Les trois listes du modèle, chacune une racine du document. */
interface McdRoots {
  properties: Y.Array<YNode>
  entities: Y.Array<YNode>
  associations: Y.Array<YNode>
}

function readMcd(roots: McdRoots): Mcd {
  return {
    properties: firstOfEachId(roots.properties).map(readProperty),
    entities: firstOfEachId(roots.entities).map(readEntity),
    associations: firstOfEachId(roots.associations).map(readAssociation),
  }
}

function readLayout(map: Y.Map<Position>): McdLayout {
  const layout: McdLayout = {}
  for (const [id, position] of map.entries()) {
    layout[id] = { x: position.x, y: position.y }
  }
  return layout
}

/* ------------------------------------------------------------------ */
/* Écriture : réconciliation du document avec l'état voulu            */

function setIfChanged(node: YNode, key: string, value: string | number | boolean): void {
  if (node.get(key) !== value) {
    node.set(key, value)
  }
}

/** Champ optionnel : absent du document quand il est absent du modèle. */
function setOptional(node: YNode, key: string, value: string | number | undefined): void {
  if (value === undefined) {
    if (node.has(key)) {
      node.delete(key)
    }
    return
  }
  setIfChanged(node, key, value)
}

/** Une liste du modèle, vue par la réconciliation. */
interface ListShape<T> {
  /** Ce qui identifie un élément d'un bout à l'autre de sa vie. */
  id: (item: T) => string
  create: (item: T) => YNode
  update: (node: YNode, item: T) => void
}

/**
 * Aligne une liste du document sur celle du modèle : les disparus sont
 * retirés, les nouveaux insérés à leur place, et d'un survivant on ne
 * touche que les champs qui ont bougé. Le réducteur n'ajoute qu'en fin
 * de liste et ne réordonne jamais, donc cet alignement reproduit chaque
 * action telle quelle.
 */
function reconcileList<T>(array: Y.Array<YNode>, items: readonly T[], shape: ListShape<T>): void {
  const wanted = new Set(items.map(shape.id))
  for (let index = array.length - 1; index >= 0; index -= 1) {
    if (!wanted.has(array.get(index).get('id') as string)) {
      array.delete(index, 1)
    }
  }

  // La première occurrence d'un identifiant gagne, comme pour le
  // dédoublonnage : une écriture locale ne doit pas atterrir sur un nœud
  // promis à l'effacement.
  const surviving = new Map<string, YNode>()
  for (const node of array) {
    const id = node.get('id') as string
    if (!surviving.has(id)) {
      surviving.set(id, node)
    }
  }

  items.forEach((item, position) => {
    const existing = surviving.get(shape.id(item))
    if (existing) {
      shape.update(existing, item)
      return
    }
    array.insert(position, [shape.create(item)])
  })
}

/*
 * Les références de propriétés n'ont pas de champ `id` : c'est la
 * propriété pointée qui les identifie. On l'écrit donc aussi sous `id`,
 * pour que la réconciliation générique s'y retrouve.
 */
const REF_SHAPE: ListShape<PropertyRef> = {
  id: (ref) => ref.propertyId,
  create: (ref) => {
    const node: YNode = new Y.Map()
    node.set('id', ref.propertyId)
    node.set('propertyId', ref.propertyId)
    node.set('isIdentifier', ref.isIdentifier)
    return node
  },
  update: (node, ref) => {
    setIfChanged(node, 'isIdentifier', ref.isIdentifier)
  },
}

/**
 * Une liste neuve, remplie d'un coup. On n'écrit que par `push` : un
 * type Yjs encore détaché de son document ne se lit pas, Yjs le signale
 * à juste titre, et la réconciliation ne vaut que pour l'attaché.
 */
function freshList<T>(items: readonly T[], shape: ListShape<T>): Y.Array<YNode> {
  const array: Y.Array<YNode> = new Y.Array()
  array.push(items.map(shape.create))
  return array
}

function setCardinality(node: YNode, cardinality: Cardinality): void {
  const current = node.get('cardinality') as Cardinality | undefined
  if (!current || current.min !== cardinality.min || current.max !== cardinality.max) {
    node.set('cardinality', { min: cardinality.min, max: cardinality.max })
  }
}

const PROPERTY_SHAPE: ListShape<Property> = {
  id: (property) => property.id,
  create: (property) => {
    const node: YNode = new Y.Map()
    node.set('id', property.id)
    node.set('name', property.name)
    node.set('type', property.type)
    if (property.size !== undefined) {
      node.set('size', property.size)
    }
    return node
  },
  update: (node, property) => {
    setIfChanged(node, 'name', property.name)
    setIfChanged(node, 'type', property.type)
    setOptional(node, 'size', property.size)
  },
}

const LEG_SHAPE: ListShape<Leg> = {
  id: (leg) => leg.id,
  create: (leg) => {
    const node: YNode = new Y.Map()
    node.set('id', leg.id)
    node.set('entityId', leg.entityId)
    node.set('cardinality', { min: leg.cardinality.min, max: leg.cardinality.max })
    if (leg.role !== undefined) {
      node.set('role', leg.role)
    }
    return node
  },
  update: (node, leg) => {
    setIfChanged(node, 'entityId', leg.entityId)
    setCardinality(node, leg.cardinality)
    setOptional(node, 'role', leg.role)
  },
}

const ENTITY_SHAPE: ListShape<Entity> = {
  id: (entity) => entity.id,
  create: (entity) => {
    const node: YNode = new Y.Map()
    node.set('id', entity.id)
    node.set('name', entity.name)
    node.set('attributes', freshList(entity.attributes, REF_SHAPE))
    return node
  },
  update: (node, entity) => {
    setIfChanged(node, 'name', entity.name)
    reconcileList(node.get('attributes') as Y.Array<YNode>, entity.attributes, REF_SHAPE)
  },
}

const ASSOCIATION_SHAPE: ListShape<Association> = {
  id: (association) => association.id,
  create: (association) => {
    const node: YNode = new Y.Map()
    node.set('id', association.id)
    node.set('name', association.name)
    node.set('attributes', freshList(association.attributes, REF_SHAPE))
    node.set('legs', freshList(association.legs, LEG_SHAPE))
    return node
  },
  update: (node, association) => {
    setIfChanged(node, 'name', association.name)
    reconcileList(node.get('attributes') as Y.Array<YNode>, association.attributes, REF_SHAPE)
    reconcileList(node.get('legs') as Y.Array<YNode>, association.legs, LEG_SHAPE)
  },
}

function reconcileLayout(map: Y.Map<Position>, layout: McdLayout): void {
  for (const id of [...map.keys()]) {
    if (!(id in layout)) {
      map.delete(id)
    }
  }
  for (const [id, position] of Object.entries(layout)) {
    const current = map.get(id)
    if (!current || current.x !== position.x || current.y !== position.y) {
      map.set(id, { x: position.x, y: position.y })
    }
  }
}

/* ------------------------------------------------------------------ */
/* Fusion des étapes d'historique                                     */

/**
 * Les actions continues (frappe dans un champ, déplacement aux flèches)
 * se fondent en une seule étape tant qu'elles visent la même cible. La
 * règle est celle d'avant Yjs, mot pour mot.
 *
 * Un geste de souris, lui, porte un jeton : toutes ses images partagent
 * alors une seule étape, quelles que soient les cibles touchées, et
 * annuler recule du geste entier. Le préfixe évite toute collision avec
 * l'identifiant d'un nœud.
 */
function actionSignature(action: McdAction): string | null {
  switch (action.type) {
    case 'RENAME_ENTITY':
    case 'RENAME_ASSOCIATION':
      return `${action.type}:${action.id}`
    case 'UPDATE_PROPERTY':
      return `${action.type}:${action.propertyId}`
    case 'SET_LEG_ROLE':
      return `${action.type}:${action.legId}`
    case 'MOVE_NODE':
      return action.gesture === undefined ? `${action.type}:${action.id}` : `GESTURE:${action.gesture}`
    case 'MOVE_NODES':
      return action.gesture === undefined ? null : `GESTURE:${action.gesture}`
    default:
      return null
  }
}

/* ------------------------------------------------------------------ */

export function createModelDoc(initial: McdEditorState, options: ModelDocOptions = {}): ModelDoc {
  const doc = new Y.Doc()
  /*
   * Chaque liste est une racine du document, nommée. C'est ce qui rend
   * la co-édition possible : une racine est la même chez tous les pairs,
   * sans que personne ait à la créer. Des listes rangées dans une Y.Map
   * seraient créées par chacun, et la fusion n'en garderait qu'une, donc
   * jetterait le modèle de l'autre.
   */
  const roots: McdRoots = {
    properties: doc.getArray<YNode>('properties'),
    entities: doc.getArray<YNode>('entities'),
    associations: doc.getArray<YNode>('associations'),
  }
  const layoutMap = doc.getMap<Position>('layout')
  const awareness = new Awareness(doc)

  // Document rempli par le réseau : il naît vide et se remplit à la
  // synchronisation. Deux pairs qui sèmeraient le même contenu
  // insèreraient chacun leurs éléments, et la fusion doublerait tout.
  if (options.seed !== false) {
    doc.transact(() => write(initial), ADOPT_ORIGIN)
  }

  function write(state: McdEditorState): void {
    reconcileList(roots.properties, state.mcd.properties, PROPERTY_SHAPE)
    reconcileList(roots.entities, state.mcd.entities, ENTITY_SHAPE)
    reconcileList(roots.associations, state.mcd.associations, ASSOCIATION_SHAPE)
    reconcileLayout(layoutMap, state.layout)
  }

  const undoManager = new Y.UndoManager(
    [roots.properties, roots.entities, roots.associations, layoutMap],
    {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
      captureTimeout: MERGE_WINDOW_MS,
    },
  )

  // Deux moitiés mises en cache à part : un déplacement de nœud ne doit
  // pas faire revalider le modèle, comme avant Yjs.
  let cachedMcd: Mcd = readMcd(roots)
  let cachedLayout: McdLayout = readLayout(layoutMap)
  let cachedState: McdEditorState = { mcd: cachedMcd, layout: cachedLayout }
  let mcdDirty = false
  let layoutDirty = false
  let changed = false
  let lastSignature: string | null = null

  const listeners = new Set<() => void>()

  for (const root of [roots.properties, roots.entities, roots.associations]) {
    root.observeDeep(() => {
      mcdDirty = true
      changed = true
    })
  }
  layoutMap.observe(() => {
    layoutDirty = true
    changed = true
  })
  // Une transaction, un avertissement : les observateurs se contentent
  // de marquer ce qui a bougé.
  doc.on('afterTransaction', () => {
    if (!changed) {
      return
    }
    changed = false
    for (const listener of [...listeners]) {
      listener()
    }
  })

  const snapshot = (): McdEditorState => {
    if (!mcdDirty && !layoutDirty) {
      return cachedState
    }
    if (mcdDirty) {
      cachedMcd = readMcd(roots)
      mcdDirty = false
    }
    if (layoutDirty) {
      cachedLayout = readLayout(layoutMap)
      layoutDirty = false
    }
    cachedState = { mcd: cachedMcd, layout: cachedLayout }
    return cachedState
  }

  /** Yjs n'offre pas de limite de pile : on la tient à la main. */
  const trimHistory = (): void => {
    const excess = undoManager.undoStack.length - HISTORY_LIMIT
    if (excess > 0) {
      undoManager.undoStack.splice(0, excess)
    }
  }

  return {
    snapshot,

    apply: (action) => {
      const signature = actionSignature(action)
      // Cible différente, ou action qui ne se fond jamais : on referme
      // l'étape en cours avant d'écrire la suivante.
      if (signature === null || signature !== lastSignature) {
        undoManager.stopCapturing()
      }
      lastSignature = signature
      const next = mcdReducer(snapshot(), action)
      doc.transact(() => write(next), LOCAL_ORIGIN)
      trimHistory()
    },

    undo: () => {
      undoManager.undo()
      lastSignature = null
    },

    redo: () => {
      undoManager.redo()
      lastSignature = null
    },

    canUndo: () => undoManager.undoStack.length > 0,
    canRedo: () => undoManager.redoStack.length > 0,

    adopt: (state) => {
      doc.transact(() => write(state), ADOPT_ORIGIN)
      // Ce n'est pas une modification de l'utilisateur : il n'y a rien à
      // annuler, ni avant ni après.
      undoManager.clear()
      lastSignature = null
    },

    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    sync: {
      stateVector: () => Y.encodeStateVector(doc),
      diffSince: (vector) => Y.encodeStateAsUpdate(doc, vector),
      applyRemote: (update) => {
        Y.applyUpdate(doc, update, REMOTE_ORIGIN)
      },
      onLocalUpdate: (listener) => {
        const handler = (update: Uint8Array, origin: unknown) => {
          // Ce qui vient du réseau ne repart pas sur le réseau.
          if (origin !== REMOTE_ORIGIN) {
            listener(update)
          }
        }
        doc.on('update', handler)
        return () => doc.off('update', handler)
      },
      awareness,
    },

    destroy: () => {
      awareness.destroy()
      undoManager.destroy()
      doc.destroy()
    },
  }
}
