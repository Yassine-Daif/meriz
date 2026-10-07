import { describe, expect, it } from 'vitest'
import { buildCodeSchema } from './codeSchema'
import type { GeneratedFile } from './codegenTypes'
import type { Mcd } from './mcd'
import { mcdToMld } from './mld'
import { DEFAULT_MPD_SETTINGS } from './mpd'
import type { SqlDialect } from './mpd'
import { symfonyFiles } from './symfony'
import { DOCTRINE_MIGRATION_VERSION } from './symfonyMigration'
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

function filesFor(mcd: Mcd, dialect: SqlDialect = 'mysql'): GeneratedFile[] {
  return symfonyFiles(buildCodeSchema(mcd, mcdToMld(mcd), DEFAULT_MPD_SETTINGS), dialect)
}

function fileAt(files: GeneratedFile[], path: string): string {
  const file = files.find((candidate) => candidate.path === path)
  if (!file) throw new Error(`fichier ${path} absent de ${files.map((f) => f.path).join(', ')}`)
  return file.content
}

/** Compte les occurrences d'un motif, pour les assertions de cardinalité. */
function count(content: string, needle: string): number {
  return content.split(needle).length - 1
}

describe('Symfony, les fichiers produits', () => {
  it('rend une entité par table et une migration', () => {
    expect(filesFor(clientCommande).map((file) => file.path)).toEqual([
      'src/Entity/Client.php',
      'src/Entity/Commande.php',
      `migrations/Version${DOCTRINE_MIGRATION_VERSION}.php`,
    ])
  })

  it('ne rend rien d’un modèle vide', () => {
    expect(filesFor({ properties: [], entities: [], associations: [] })).toEqual([])
  })

  it('commence chaque fichier par une balise PHP et déclare le bon espace de noms', () => {
    for (const file of filesFor(inscription)) {
      expect(file.content.startsWith('<?php\n')).toBe(true)
    }
    expect(fileAt(filesFor(inscription), 'src/Entity/Cours.php')).toContain('namespace App\\Entity;')
  })
})

describe('Symfony, identifiants et colonnes', () => {
  it('génère la valeur d’une clé simple auto-incrémentée, et d’elle seule', () => {
    const client = fileAt(filesFor(clientCommande), 'src/Entity/Client.php')

    expect(client).toContain('#[ORM\\Id]')
    expect(count(client, '#[ORM\\GeneratedValue]')).toBe(1)
    expect(client).toContain("#[ORM\\Column(name: 'numero_client')]")
    expect(client).toContain('private ?int $numeroClient = null;')
    // Une clé auto-incrémentée n'a pas de setter : la base la pose.
    expect(client).not.toContain('public function setNumeroClient(')
  })

  it('pose deux identifiants et aucune génération sur une clé composée', () => {
    const vol = fileAt(filesFor(vols), 'src/Entity/Vol.php')

    expect(count(vol, '#[ORM\\Id]')).toBe(2)
    expect(vol).not.toContain('#[ORM\\GeneratedValue]')
    expect(vol).toContain("#[ORM\\Column(name: 'numero_vol', length: 8)]")
    expect(vol).toContain('public function setNumeroVol(string $numeroVol): static')
  })

  it('mappe les types Doctrine et la taille', () => {
    const cours = fileAt(filesFor(inscription), 'src/Entity/Cours.php')
    expect(cours).toContain("#[ORM\\Column(name: 'code_cours', length: 10)]")

    const inscrire = fileAt(filesFor(inscription), 'src/Entity/Inscrire.php')
    expect(inscrire).toContain('type: Types::DECIMAL, precision: 10, scale: 2')
    expect(inscrire).toContain('use Doctrine\\DBAL\\Types\\Types;')

    const employe = fileAt(filesFor(occupation), 'src/Entity/Employe.php')
    expect(employe).toContain('private ?bool $estCadre = null;')
    const bureau = fileAt(filesFor(occupation), 'src/Entity/Bureau.php')
    expect(bureau).toContain('type: Types::TIME_MUTABLE')

    const livrer = fileAt(filesFor(livraisonTernaire), 'src/Entity/Livrer.php')
    expect(livrer).toContain('type: Types::DATETIME_MUTABLE')
  })

  it('signale une entité sans identifiant', () => {
    expect(fileAt(filesFor(entiteSansIdentifiant), 'src/Entity/Note.php')).toContain(
      "// Attention : Note n'a pas d'identifiant dans le MCD.",
    )
  })
})

describe('Symfony, relations', () => {
  it('écrit un ManyToOne du côté de la clé et un OneToMany en face', () => {
    const files = filesFor(clientCommande)

    const commande = fileAt(files, 'src/Entity/Commande.php')
    expect(commande).toContain('/** Commande (1,1) passer Client (0,n). */')
    expect(commande).toContain("#[ORM\\ManyToOne(targetEntity: Client::class, inversedBy: 'commandes')]")
    expect(commande).toContain(
      "#[ORM\\JoinColumn(name: 'numero_client', referencedColumnName: 'numero_client', nullable: false)]",
    )
    expect(commande).toContain('private ?Client $client = null;')

    const client = fileAt(files, 'src/Entity/Client.php')
    expect(client).toContain("#[ORM\\OneToMany(targetEntity: Commande::class, mappedBy: 'client')]")
    expect(client).toContain('private Collection $commandes;')
    expect(client).toContain('$this->commandes = new ArrayCollection();')
    expect(client).toContain('public function addCommande(Commande $commande): static')
    expect(client).toContain('public function removeCommande(Commande $commande): static')
  })

  it('rend la jointure facultative quand la cardinalité le dit', () => {
    expect(fileAt(filesFor(clientCommandeOptionnel), 'src/Entity/Commande.php')).toContain('nullable: true)]')
  })

  it('écrit un OneToOne des deux côtés pour un un à un', () => {
    const files = filesFor(occupation)

    expect(fileAt(files, 'src/Entity/Employe.php')).toContain(
      "#[ORM\\OneToOne(targetEntity: Bureau::class, inversedBy: 'employe')]",
    )
    expect(fileAt(files, 'src/Entity/Bureau.php')).toContain(
      "#[ORM\\OneToOne(targetEntity: Employe::class, mappedBy: 'bureau')]",
    )
  })

  it('répète la colonne de jointure pour une clé composée', () => {
    const reservation = fileAt(filesFor(vols), 'src/Entity/Reservation.php')

    expect(count(reservation, '#[ORM\\JoinColumn(')).toBe(2)
    expect(reservation).toContain("#[ORM\\JoinColumn(name: 'numero_vol', referencedColumnName: 'numero_vol'")
    expect(reservation).toContain("#[ORM\\JoinColumn(name: 'date_vol', referencedColumnName: 'date_vol'")
    expect(reservation).toContain('private ?Vol $vol = null;')
  })

  it('écrit un ManyToMany avec sa table de jointure d’un seul côté', () => {
    const files = filesFor(vols)

    const passager = fileAt(files, 'src/Entity/Passager.php')
    expect(passager).toContain("#[ORM\\ManyToMany(targetEntity: Vol::class, inversedBy: 'passagers')]")
    expect(passager).toContain("#[ORM\\JoinTable(name: 'embarquer')]")
    expect(count(passager, '#[ORM\\InverseJoinColumn(')).toBe(2)

    const vol = fileAt(files, 'src/Entity/Vol.php')
    expect(vol).toContain("#[ORM\\ManyToMany(targetEntity: Passager::class, mappedBy: 'vols')]")
    expect(vol).not.toContain('#[ORM\\JoinTable(')
  })

  it('fait une entité d’une association porteuse, dont l’identité passe par ses relations', () => {
    const files = filesFor(inscription)

    const inscrire = fileAt(files, 'src/Entity/Inscrire.php')
    expect(count(inscrire, '#[ORM\\Id]')).toBe(2)
    expect(count(inscrire, '#[ORM\\ManyToOne(')).toBe(2)
    expect(inscrire).toContain('private ?string $note = null;')
    // Doctrine refuse un ManyToMany porteur : aucun n'est écrit.
    expect(fileAt(files, 'src/Entity/Etudiant.php')).not.toContain('#[ORM\\ManyToMany(')
  })

  it('ne fait pas d’entité d’un pivot pur', () => {
    const pur = {
      ...inscription,
      associations: [{ ...inscription.associations[0]!, attributes: [] }],
    } satisfies Mcd

    const paths = filesFor(pur).map((file) => file.path)
    expect(paths).not.toContain('src/Entity/Inscrire.php')
    expect(fileAt(filesFor(pur), 'src/Entity/Etudiant.php')).toContain('#[ORM\\ManyToMany(')
  })

  it('vise self et nomme d’après les rôles en réflexif', () => {
    const etudiant = fileAt(filesFor(tutorat), 'src/Entity/Etudiant.php')

    expect(etudiant).toContain("#[ORM\\ManyToOne(targetEntity: self::class, inversedBy: 'tutores')]")
    expect(etudiant).toContain("#[ORM\\OneToMany(targetEntity: self::class, mappedBy: 'tuteur')]")
    expect(etudiant).toContain('private ?self $tuteur = null;')
    expect(etudiant).toContain('public function addTutore(self $tutore): static')
  })

  it('écrit trois ManyToOne pour un ternaire, et aucun ManyToMany', () => {
    const livrer = fileAt(filesFor(livraisonTernaire), 'src/Entity/Livrer.php')

    expect(count(livrer, '#[ORM\\ManyToOne(')).toBe(3)
    expect(count(livrer, '#[ORM\\Id]')).toBe(3)
    for (const classe of ['Fournisseur', 'Produit', 'Magasin']) {
      expect(fileAt(filesFor(livraisonTernaire), `src/Entity/${classe}.php`)).not.toContain(
        '#[ORM\\ManyToMany(',
      )
    }
  })
})

describe('Symfony, migration Doctrine', () => {
  it('porte une version déterministe et une instruction par ligne du SQL', () => {
    const migration = fileAt(filesFor(clientCommande), `migrations/Version${DOCTRINE_MIGRATION_VERSION}.php`)

    expect(migration).toContain(`final class Version${DOCTRINE_MIGRATION_VERSION} extends AbstractMigration`)
    expect(migration).toContain('use Doctrine\\Migrations\\AbstractMigration;')
    // Deux créations de table, une contrainte, puis deux suppressions.
    expect(count(migration, '$this->addSql(')).toBe(5)
    expect(migration).toContain('CREATE TABLE clients')
    expect(migration).toContain('ADD CONSTRAINT fk_commandes_clients')
    expect(migration).toContain("DROP TABLE IF EXISTS commandes")
  })

  it('suit le dialecte choisi au MPD', () => {
    const migration = fileAt(
      filesFor(clientCommande, 'postgresql'),
      `migrations/Version${DOCTRINE_MIGRATION_VERSION}.php`,
    )

    expect(migration).toContain('SERIAL')
    expect(migration).not.toContain('AUTO_INCREMENT')
  })

  it('supprime les tables dans l’ordre inverse de la création', () => {
    const migration = fileAt(filesFor(vols), `migrations/Version${DOCTRINE_MIGRATION_VERSION}.php`)
    const down = migration.slice(migration.indexOf('public function down'))

    expect(down.indexOf('DROP TABLE IF EXISTS embarquer')).toBeLessThan(
      down.indexOf('DROP TABLE IF EXISTS vols'),
    )
  })
})
