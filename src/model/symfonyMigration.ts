import type { CodeSchema } from './codeSchema'
import type { GeneratedFile } from './codegenTypes'
import { mpdToSql, sortForCreation } from './mpd'
import type { SqlDialect } from './mpd'
import { phpString } from './php'

/**
 * Migration Doctrine : une classe `Version...` qui pose le schéma.
 *
 * Le SQL vient du MPD, donc du dialecte et des surcharges choisis dans
 * la vue MPD : il n'y a qu'un seul émetteur de SQL dans le projet.
 *
 * L'horodatage est figé. Doctrine ne s'en sert que comme identifiant de
 * version, donc une valeur fixe rend la génération déterministe ; l'avis
 * de la vue dit de renommer le fichier avant de l'ajouter à un projet
 * qui a déjà des migrations.
 */

export const DOCTRINE_MIGRATION_VERSION = '20250101000000'

/** Une instruction par bloc : `mpdToSql` les sépare par une ligne vide. */
function statements(sql: string): string[] {
  return sql
    .split(/\n{2,}/)
    .map((block) => block.trim().replace(/;$/, ''))
    .filter((block) => block !== '')
}

export function symfonyMigrationFile(schema: CodeSchema, dialect: SqlDialect): GeneratedFile {
  const up = statements(mpdToSql(schema.physicalTables, dialect, { includeDrops: false }))
  const down = sortForCreation(schema.physicalTables)
    .map((table) => `DROP TABLE IF EXISTS ${table.name}`)
    .reverse()

  const toSql = (lines: string[]): string =>
    lines.map((line) => `        $this->addSql(${phpString(line)});`).join('\n')

  const content = `<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\\DBAL\\Schema\\Schema;
use Doctrine\\Migrations\\AbstractMigration;

/** Schéma initial, dérivé du MCD par Meriz. */
final class Version${DOCTRINE_MIGRATION_VERSION} extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Schéma initial généré depuis le MCD par Meriz.';
    }

    public function up(Schema $schema): void
    {
${toSql(up)}
    }

    public function down(Schema $schema): void
    {
${toSql(down)}
    }
}
`

  return { path: `migrations/Version${DOCTRINE_MIGRATION_VERSION}.php`, content }
}
