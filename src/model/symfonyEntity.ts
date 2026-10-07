import type { CodeSchema, Relation, SchemaColumn, SchemaTable } from './codeSchema'
import type { GeneratedFile } from './codegenTypes'
import { phpString } from './php'

/**
 * Entités Doctrine : une classe par table, attributs ORM de PHP 8,
 * propriétés privées en camelCase, accesseurs d'usage.
 *
 * Deux règles de Doctrine commandent la forme. Une colonne de clé
 * étrangère n'est jamais une propriété scalaire : c'est l'association
 * qui la porte, par ses colonnes de jointure. Et une association qui
 * porte un attribut ne peut pas être un `ManyToMany` : elle devient une
 * entité, dont l'identité passe par ses relations.
 */

interface ColumnFormat {
  /** Le corps de `#[ORM\\Column(...)]`, sans le nom ni le nullable. */
  attribute: string
  phpType: string
  /** Vrai quand la classe `Types` doit être importée. */
  needsTypes: boolean
}

function columnFormat(column: SchemaColumn): ColumnFormat {
  switch (column.conceptualType) {
    case 'texte':
      return { attribute: `length: ${column.size ?? 255}`, phpType: 'string', needsTypes: false }
    case 'entier':
      return { attribute: '', phpType: 'int', needsTypes: false }
    case 'decimal':
      return {
        attribute: 'type: Types::DECIMAL, precision: 10, scale: 2',
        phpType: 'string',
        needsTypes: true,
      }
    case 'booleen':
      return { attribute: '', phpType: 'bool', needsTypes: false }
    case 'date':
      return { attribute: 'type: Types::DATE_MUTABLE', phpType: '\\DateTimeInterface', needsTypes: true }
    case 'datetime':
      return {
        attribute: 'type: Types::DATETIME_MUTABLE',
        phpType: '\\DateTimeInterface',
        needsTypes: true,
      }
    case 'heure':
      return { attribute: 'type: Types::TIME_MUTABLE', phpType: '\\DateTimeInterface', needsTypes: true }
  }
}

function studly(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function className(schema: CodeSchema, tableId: string): string {
  return schema.tables.find((table) => table.id === tableId)?.className ?? 'object'
}

/** Colonnes qui restent des propriétés scalaires. */
function scalarColumns(table: SchemaTable): SchemaColumn[] {
  return table.columns.filter((column) => column.foreignKey === undefined)
}

function joinColumns(relation: Relation, nullable: boolean): string[] {
  return relation.key.map(
    (pair) =>
      `    #[ORM\\JoinColumn(name: ${phpString(pair.foreignColumn)}, ` +
      `referencedColumnName: ${phpString(pair.referencedColumn)}, nullable: ${nullable ? 'true' : 'false'})]`,
  )
}

export function symfonyEntityFile(table: SchemaTable, schema: CodeSchema): GeneratedFile {
  const imports = new Set<string>(['use Doctrine\\ORM\\Mapping as ORM;'])
  const properties: string[] = []
  const methods: string[] = []
  const constructorLines: string[] = []

  /* -------- Colonnes scalaires -------- */
  for (const column of scalarColumns(table)) {
    const format = columnFormat(column)
    if (format.needsTypes) {
      imports.add('use Doctrine\\DBAL\\Types\\Types;')
    }
    const parts = [`name: ${phpString(column.columnName)}`]
    if (format.attribute !== '') parts.push(format.attribute)
    if (column.nullable) parts.push('nullable: true')

    const lines: string[] = []
    if (column.isPrimaryKey) {
      lines.push('    #[ORM\\Id]')
      // Doctrine ne génère une valeur que sur une clé simple et entière.
      if (column.autoIncrement) lines.push('    #[ORM\\GeneratedValue]')
    }
    if (column.overridden) {
      lines.push(`    // Type imposé au MPD : ${column.sqlType}`)
    }
    lines.push(`    #[ORM\\Column(${parts.join(', ')})]`)
    lines.push(`    private ?${format.phpType} $${column.propertyName} = null;`)
    properties.push(lines.join('\n'))

    const name = studly(column.propertyName)
    methods.push(
      [
        `    public function get${name}(): ?${format.phpType}`,
        '    {',
        `        return $this->${column.propertyName};`,
        '    }',
      ].join('\n'),
    )
    if (!column.autoIncrement) {
      const argument = column.nullable ? `?${format.phpType}` : format.phpType
      methods.push(
        [
          `    public function set${name}(${argument} $${column.propertyName}): static`,
          '    {',
          `        $this->${column.propertyName} = $${column.propertyName};`,
          '',
          '        return $this;',
          '    }',
        ].join('\n'),
      )
    }
  }

  /* -------- Relations -------- */
  for (const relation of table.relations) {
    if (relation.key.length === 0) continue
    const target = relation.selfReferencing ? 'self' : className(schema, relation.targetTableId)
    const targetType = relation.selfReferencing ? 'self' : target
    const name = studly(relation.name)

    if (relation.kind === 'manyToOne' || relation.kind === 'oneToOne') {
      const attribute = relation.kind === 'manyToOne' ? 'ManyToOne' : 'OneToOne'
      const lines: string[] = [`    /** ${relation.comment} */`]
      // Dans une jonction, l'identité passe par les relations.
      if (table.origin === 'junction') {
        lines.push('    #[ORM\\Id]')
      }
      lines.push(
        `    #[ORM\\${attribute}(targetEntity: ${target}::class, inversedBy: ${phpString(relation.inverseName)})]`,
      )
      lines.push(...joinColumns(relation, relation.nullable))
      lines.push(`    private ?${targetType} $${relation.name} = null;`)
      properties.push(lines.join('\n'))

      methods.push(
        [
          `    public function get${name}(): ?${targetType}`,
          '    {',
          `        return $this->${relation.name};`,
          '    }',
        ].join('\n'),
      )
      methods.push(
        [
          `    public function set${name}(?${targetType} $${relation.name}): static`,
          '    {',
          `        $this->${relation.name} = $${relation.name};`,
          '',
          '        return $this;',
          '    }',
        ].join('\n'),
      )
      continue
    }

    if (relation.kind === 'oneToOneInverse') {
      properties.push(
        [
          `    /** ${relation.comment} */`,
          `    #[ORM\\OneToOne(targetEntity: ${target}::class, mappedBy: ${phpString(relation.inverseName)})]`,
          `    private ?${targetType} $${relation.name} = null;`,
        ].join('\n'),
      )
      methods.push(
        [
          `    public function get${name}(): ?${targetType}`,
          '    {',
          `        return $this->${relation.name};`,
          '    }',
        ].join('\n'),
      )
      methods.push(
        [
          `    public function set${name}(?${targetType} $${relation.name}): static`,
          '    {',
          `        $this->${relation.name} = $${relation.name};`,
          '',
          '        return $this;',
          '    }',
        ].join('\n'),
      )
      continue
    }

    /* oneToMany : une collection, avec ses adder et remover. */
    imports.add('use Doctrine\\Common\\Collections\\ArrayCollection;')
    imports.add('use Doctrine\\Common\\Collections\\Collection;')
    properties.push(
      [
        '    /**',
        `     * ${relation.comment}`,
        '     *',
        `     * @var Collection<int, ${targetType}>`,
        '     */',
        `    #[ORM\\OneToMany(targetEntity: ${target}::class, mappedBy: ${phpString(relation.inverseName)})]`,
        `    private Collection $${relation.name};`,
      ].join('\n'),
    )
    constructorLines.push(`        $this->${relation.name} = new ArrayCollection();`)
    /*
     * Le nom d'un adder vient de la classe visée. En réflexif il n'y a
     * pas d'autre classe : on retire le s final du nom de collection,
     * comme le fait le maker de Symfony.
     */
    const singular = relation.name.endsWith('s') ? relation.name.slice(0, -1) : relation.name
    const item = relation.selfReferencing ? studly(singular) : target
    const argument = relation.selfReferencing
      ? singular
      : target.charAt(0).toLowerCase() + target.slice(1)
    methods.push(
      [
        `    /** @return Collection<int, ${targetType}> */`,
        `    public function get${name}(): Collection`,
        '    {',
        `        return $this->${relation.name};`,
        '    }',
      ].join('\n'),
    )
    methods.push(
      [
        `    public function add${item}(${targetType} $${argument}): static`,
        '    {',
        `        if (!$this->${relation.name}->contains($${argument})) {`,
        `            $this->${relation.name}->add($${argument});`,
        `            $${argument}->set${studly(relation.inverseName)}($this);`,
        '        }',
        '',
        '        return $this;',
        '    }',
      ].join('\n'),
    )
    methods.push(
      [
        `    public function remove${item}(${targetType} $${argument}): static`,
        '    {',
        `        if ($this->${relation.name}->removeElement($${argument})`,
        `            && $${argument}->get${studly(relation.inverseName)}() === $this) {`,
        `            $${argument}->set${studly(relation.inverseName)}(null);`,
        '        }',
        '',
        '        return $this;',
        '    }',
      ].join('\n'),
    )
  }

  /* -------- Plusieurs à plusieurs -------- */
  for (const relation of table.manyToMany) {
    if (relation.payloadColumns.length > 0) {
      // Doctrine demande une entité dès qu'un attribut est porté : elle
      // est générée à part, et cette lecture n'existe pas ici.
      continue
    }
    imports.add('use Doctrine\\Common\\Collections\\ArrayCollection;')
    imports.add('use Doctrine\\Common\\Collections\\Collection;')
    const target = className(schema, relation.targetTableId)
    const name = studly(relation.name)
    const lines: string[] = [
      '    /**',
      `     * ${relation.comment}`,
      '     *',
      `     * @var Collection<int, ${target}>`,
      '     */',
    ]
    if (relation.owner) {
      lines.push(
        `    #[ORM\\ManyToMany(targetEntity: ${target}::class, inversedBy: ${phpString(relation.inverseName)})]`,
      )
      lines.push(`    #[ORM\\JoinTable(name: ${phpString(relation.pivotTableName)})]`)
      for (const pair of relation.localKey) {
        lines.push(
          `    #[ORM\\JoinColumn(name: ${phpString(pair.foreignColumn)}, ` +
            `referencedColumnName: ${phpString(pair.referencedColumn)})]`,
        )
      }
      for (const pair of relation.targetKey) {
        lines.push(
          `    #[ORM\\InverseJoinColumn(name: ${phpString(pair.foreignColumn)}, ` +
            `referencedColumnName: ${phpString(pair.referencedColumn)})]`,
        )
      }
    } else {
      lines.push(
        `    #[ORM\\ManyToMany(targetEntity: ${target}::class, mappedBy: ${phpString(relation.inverseName)})]`,
      )
    }
    lines.push(`    private Collection $${relation.name};`)
    properties.push(lines.join('\n'))
    constructorLines.push(`        $this->${relation.name} = new ArrayCollection();`)

    methods.push(
      [
        `    /** @return Collection<int, ${target}> */`,
        `    public function get${name}(): Collection`,
        '    {',
        `        return $this->${relation.name};`,
        '    }',
      ].join('\n'),
    )
    methods.push(
      [
        `    public function add${target}(${target} $element): static`,
        '    {',
        `        if (!$this->${relation.name}->contains($element)) {`,
        `            $this->${relation.name}->add($element);`,
        '        }',
        '',
        '        return $this;',
        '    }',
      ].join('\n'),
    )
    methods.push(
      [
        `    public function remove${target}(${target} $element): static`,
        '    {',
        `        $this->${relation.name}->removeElement($element);`,
        '',
        '        return $this;',
        '    }',
      ].join('\n'),
    )
  }

  const constructor =
    constructorLines.length === 0
      ? []
      : [['    public function __construct()', '    {', ...constructorLines, '    }'].join('\n')]

  const warning =
    table.primaryKey.length === 0 && table.origin === 'entity'
      ? [`    // Attention : ${table.sourceName} n'a pas d'identifiant dans le MCD.`, '']
      : []

  const origin =
    table.origin === 'entity'
      ? `Entité ${table.sourceName} du MCD.`
      : `Jonction ${table.sourceName} du MCD, née d'une association.`

  const content = `<?php

namespace App\\Entity;

${[...imports].sort().join('\n')}

/** ${origin} */
#[ORM\\Entity]
#[ORM\\Table(name: ${phpString(table.tableName)})]
class ${table.className}
{
${warning.join('\n')}${properties.join('\n\n')}

${[...constructor, ...methods].join('\n\n')}
}
`

  return { path: `src/Entity/${table.className}.php`, content }
}
