import { describe, expect, it } from 'vitest'
import { buildCodeSchema } from './codeSchema'
import type { GeneratedFile } from './codegenTypes'
import { laravelFiles } from './laravel'
import type { Mcd } from './mcd'
import { mcdToMld } from './mld'
import { DEFAULT_MPD_SETTINGS } from './mpd'
import {
  clientCommande,
  clientCommandeOptionnel,
  entiteSansIdentifiant,
  inscription,
  livraisonTernaire,
  occupation,
  tutorat,
  vols,
} from './testFixtures'

function filesFor(mcd: Mcd): GeneratedFile[] {
  return laravelFiles(buildCodeSchema(mcd, mcdToMld(mcd), DEFAULT_MPD_SETTINGS))
}

function fileAt(files: GeneratedFile[], path: string): string {
  const file = files.find((candidate) => candidate.path === path)
  if (!file) throw new Error(`fichier ${path} absent de ${files.map((f) => f.path).join(', ')}`)
  return file.content
}

describe('Laravel, les fichiers produits', () => {
  it('rend une migration par table et un modèle par entité', () => {
    expect(filesFor(clientCommande).map((file) => file.path)).toEqual([
      'database/migrations/2025_01_01_000001_create_clients_table.php',
      'database/migrations/2025_01_01_000002_create_commandes_table.php',
      'app/Models/Client.php',
      'app/Models/Commande.php',
    ])
  })

  it('crée une table référencée avant celle qui la référence', () => {
    const paths = filesFor(vols).map((file) => file.path)
    const vol = paths.findIndex((path) => path.includes('create_vols_table'))
    const reservation = paths.findIndex((path) => path.includes('create_reservations_table'))
    expect(vol).toBeLessThan(reservation)
  })

  it('commence chaque fichier par une balise PHP', () => {
    for (const file of filesFor(inscription)) {
      expect(file.content.startsWith('<?php\n')).toBe(true)
    }
  })
})

describe('Laravel, migrations', () => {
  it('pose un identifiant auto-incrémenté avec id()', () => {
    const content = fileAt(filesFor(clientCommande), 'database/migrations/2025_01_01_000001_create_clients_table.php')

    expect(content).toContain("$table->id('numero_client');")
    expect(content).toContain("$table->string('nom');")
    expect(content).toContain('$table->timestamps();')
    expect(content).toContain("Schema::dropIfExists('clients');")
  })

  it('contraint une clé étrangère simple vers une clé auto-incrémentée', () => {
    const content = fileAt(
      filesFor(clientCommande),
      'database/migrations/2025_01_01_000002_create_commandes_table.php',
    )

    expect(content).toContain("$table->foreignId('numero_client')->constrained('clients', 'numero_client');")
  })

  it('rend la clé étrangère facultative quand la cardinalité le dit', () => {
    const content = fileAt(
      filesFor(clientCommandeOptionnel),
      'database/migrations/2025_01_01_000002_create_commandes_table.php',
    )

    expect(content).toContain("->nullable()->constrained('clients', 'numero_client');")
  })

  it('déclare une clé primaire composée', () => {
    const content = fileAt(filesFor(vols), 'database/migrations/2025_01_01_000001_create_vols_table.php')

    expect(content).toContain("$table->string('numero_vol', 8);")
    expect(content).toContain("$table->date('date_vol');")
    expect(content).toContain("$table->primary(['numero_vol', 'date_vol']);")
    expect(content).not.toContain('$table->id(')
  })

  it('déclare une clé étrangère composée à part', () => {
    const content = fileAt(
      filesFor(vols),
      'database/migrations/2025_01_01_000002_create_reservations_table.php',
    )

    expect(content).toContain(
      "$table->foreign(['numero_vol', 'date_vol'])->references(['numero_vol', 'date_vol'])->on('vols');",
    )
  })

  it('déclare une clé primaire simple non auto-incrémentée', () => {
    const files = filesFor(inscription)
    const content = fileAt(files, 'database/migrations/2025_01_01_000002_create_cours_table.php')

    expect(content).toContain("$table->string('code_cours', 10);")
    expect(content).toContain("$table->primary('code_cours');")
  })

  it('ne pose pas de timestamps sur un pivot absorbé', () => {
    const pivot = fileAt(
      filesFor(vols),
      'database/migrations/2025_01_01_000004_create_embarquer_table.php',
    )
    const entite = fileAt(filesFor(vols), 'database/migrations/2025_01_01_000001_create_vols_table.php')

    // embarquer garde un modèle (clé composée), donc ses timestamps.
    expect(entite).toContain('$table->timestamps();')
    expect(pivot).toContain('$table->timestamps();')
  })

  it('signale une entité sans identifiant', () => {
    const content = fileAt(
      filesFor(entiteSansIdentifiant),
      'database/migrations/2025_01_01_000002_create_notes_table.php',
    )

    expect(content).toContain("// Attention : Note n'a pas d'identifiant dans le MCD.")
    expect(content).not.toContain('$table->primary(')
  })

  it('traduit les sept types conceptuels', () => {
    const occupe = filesFor(occupation)
    expect(fileAt(occupe, 'database/migrations/2025_01_01_000002_create_employes_table.php')).toContain(
      "$table->boolean('est_cadre');",
    )
    expect(fileAt(occupe, 'database/migrations/2025_01_01_000001_create_bureaux_table.php')).toContain(
      "$table->time('heure_ouverture');",
    )

    const livraison = filesFor(livraisonTernaire)
    const pivot = fileAt(livraison, 'database/migrations/2025_01_01_000004_create_livrer_table.php')
    expect(pivot).toContain("$table->integer('quantite');")
    expect(pivot).toContain("$table->dateTime('livree_le');")
  })
})

describe('Laravel, modèles et relations', () => {
  it('écrit un belongsTo du côté de la clé et un hasMany en face', () => {
    const files = filesFor(clientCommande)

    const commande = fileAt(files, 'app/Models/Commande.php')
    expect(commande).toContain('/** Commande (1,1) passer Client (0,n). */')
    expect(commande).toContain('public function client(): BelongsTo')
    expect(commande).toContain("return $this->belongsTo(Client::class, 'numero_client', 'numero_client');")
    expect(commande).toContain("protected $table = 'commandes';")
    expect(commande).toContain("protected $primaryKey = 'numero_commande';")

    const client = fileAt(files, 'app/Models/Client.php')
    expect(client).toContain('public function commandes(): HasMany')
    expect(client).toContain("return $this->hasMany(Commande::class, 'numero_client', 'numero_client');")
    expect(client).toContain("protected $fillable = [\n        'nom',\n    ];")
  })

  it('écrit un belongsTo et un hasOne pour un un à un', () => {
    const files = filesFor(occupation)

    expect(fileAt(files, 'app/Models/Employe.php')).toContain('public function bureau(): BelongsTo')
    expect(fileAt(files, 'app/Models/Bureau.php')).toContain('public function employe(): HasOne')
  })

  it('écrit un belongsToMany de chaque côté d’un plusieurs à plusieurs, avec les attributs portés', () => {
    const files = filesFor(inscription)

    const etudiant = fileAt(files, 'app/Models/Etudiant.php')
    expect(etudiant).toContain('public function cours(): BelongsToMany')
    expect(etudiant).toContain("            'inscrire',")
    expect(etudiant).toContain("->withPivot('note');")
    expect(fileAt(files, 'app/Models/Cours.php')).toContain('public function etudiants(): BelongsToMany')
  })

  it('donne aussi un modèle de jonction à une association porteuse', () => {
    const files = filesFor(inscription)

    const jonction = fileAt(files, 'app/Models/Inscrire.php')
    expect(jonction).toContain('public function etudiant(): BelongsTo')
    expect(jonction).toContain('public function cours(): BelongsTo')
    expect(jonction).toContain('public $incrementing = false;')
    expect(jonction).toContain('// Eloquent ne gère pas les clés primaires composées')
  })

  it('n’écrit aucun modèle pour un pivot pur', () => {
    const paths = filesFor(livraisonTernaire).map((file) => file.path)

    // Trois pattes : la jonction est une entité à part entière.
    expect(paths).toContain('app/Models/Livrer.php')
    const pivotPur = filesFor({
      ...inscription,
      associations: [{ ...inscription.associations[0]!, attributes: [] }],
    } satisfies Mcd).map((file) => file.path)
    expect(pivotPur).not.toContain('app/Models/Inscrire.php')
  })

  it('nomme une relation réflexive d’après les rôles et vise self', () => {
    const content = fileAt(filesFor(tutorat), 'app/Models/Etudiant.php')

    expect(content).toContain('public function tuteur(): BelongsTo')
    expect(content).toContain("return $this->belongsTo(self::class, 'tuteur_numero_etudiant', 'numero_etudiant');")
    expect(content).toContain('public function tutores(): HasMany')
  })

  it('dit en commentaire ce qu’Eloquent ne sait pas suivre', () => {
    const files = filesFor(vols)

    const reservation = fileAt(files, 'app/Models/Reservation.php')
    expect(reservation).toContain('Clé étrangère composée (numero_vol, date_vol) vers Vol')
    expect(reservation).toContain("Eloquent ne sait pas")
    expect(reservation).not.toContain('public function vol(')

    const passager = fileAt(files, 'app/Models/Passager.php')
    expect(passager).toContain('Table pivot embarquer à clé composée')
    expect(fileAt(files, 'app/Models/Embarquer.php')).toContain('public function passager(): BelongsTo')
  })

  it('exclut l’auto-incrément du fillable et garde les clés étrangères', () => {
    const content = fileAt(filesFor(tutorat), 'app/Models/Etudiant.php')

    expect(content).toContain("protected $fillable = [\n        'tuteur_numero_etudiant',\n    ];")
    expect(content).not.toContain("'numero_etudiant',\n        'tuteur")
  })

  it('écrit keyType et incrementing quand la clé n’est pas un entier auto', () => {
    const content = fileAt(filesFor(inscription), 'app/Models/Cours.php')

    expect(content).toContain("protected $keyType = 'string';")
    expect(content).toContain('public $incrementing = false;')
  })
})
