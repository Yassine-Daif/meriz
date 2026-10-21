import { exampleMcd, exampleLayout, EXAMPLE_NAME } from '../model/example'
import type { Mcd } from '../model/mcd'
import { getLanguage, t } from './runtime'
export function builtInExample() {
  const mcd: Mcd = getLanguage() === 'fr' ? exampleMcd : {
    ...exampleMcd,
    properties: exampleMcd.properties.map(property => ({ ...property, name: t(property.name) })),
    entities: exampleMcd.entities.map(entity => ({ ...entity, name: t(entity.name) })),
    associations: exampleMcd.associations.map(association => ({ ...association, name: t(association.name) })),
  }
  return { name: t(EXAMPLE_NAME), state: { mcd, layout: exampleLayout } }
}
/** Les exemples de code de l'aide sont des constantes, jamais du code saisi par un utilisateur. */
export function exampleCode(source: string): string {
  if (getLanguage() === 'fr') return source
  const sql = /CREATE TABLE|SELECT /.test(source)
  const names: Record<string, string> = { Client: 'Customer', Commande: sql ? String.fromCharCode(96) + 'Order' + String.fromCharCode(96) : 'Order', numeroClient: 'customerNumber', numeroCommande: 'orderNumber', dateCommande: 'orderDate', nom: 'name', client: 'customer', commandes: 'orders', getClient: 'getCustomer', setClient: 'setCustomer' }
  return source.replace(/\b(Client|Commande|numeroClient|numeroCommande|dateCommande|nom|client|commandes|getClient|setClient)\b/g, word => names[word])
}
