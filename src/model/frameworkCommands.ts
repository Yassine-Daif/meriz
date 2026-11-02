import { t } from '../i18n/runtime'
import type { GeneratedFile, FrameworkId } from './codegenTypes'

export type SymfonyMigrationLocation = 'modern' | 'classic'
export type SymfonyWorkflow = 'entities' | 'migration'
export interface FrameworkCommands { title: string; explanation: string; commands: string[]; files: GeneratedFile[] }

/** Aucune commande destructive, aucun accès à une base depuis Meriz. */
export function frameworkCommands(framework: FrameworkId, files: GeneratedFile[], workflow: SymfonyWorkflow, location: SymfonyMigrationLocation = 'modern'): FrameworkCommands {
  if (framework === 'symfony' && workflow === 'entities') return {
    title: t('Entités puis migration Doctrine'),
    explanation: t('Copiez les entités dans src/Entity. Doctrine comparera ces entités à votre base pour générer une migration. La migration fournie par Meriz est exclue de ce parcours.'),
    files: files.filter(file => !file.path.startsWith('migrations/') && !file.path.startsWith('src/Migrations/')),
    commands: ['php bin/console doctrine:schema:validate --skip-sync', 'php bin/console make:migration', 'php bin/console doctrine:migrations:migrate --dry-run', 'php bin/console doctrine:migrations:migrate'],
  }
  if (framework === 'symfony') return {
    title: t('Migration fournie par Meriz'),
    explanation: t('Copiez les entités et la migration dans un projet prêt à les recevoir. Renommez la classe et le fichier de migration avec un identifiant libre. Ne lancez pas make:migration pour recréer les mêmes tables.'),
    files: location === 'classic' ? files : files.map(file => file.path.startsWith('migrations/') ? { path: file.path.replace('migrations/', 'src/Migrations/'), content: file.content.replace('namespace DoctrineMigrations;', 'namespace App\\Migrations;') } : file),
    commands: ['php bin/console doctrine:migrations:status', 'php bin/console doctrine:migrations:migrate --dry-run', 'php bin/console doctrine:migrations:migrate'],
  }
  return {
    title: t('Modèles et migrations Laravel'),
    explanation: t('Copiez les modèles dans app/Models et les migrations dans database/migrations. Les fichiers contiennent déjà les colonnes et les relations : ne créez pas une seconde migration pour les mêmes tables. Adaptez les dates des fichiers dans un projet existant.'),
    files, commands: ['php artisan migrate:status', 'php artisan migrate --pretend', 'php artisan migrate'],
  }
}
