import { describe, expect, it } from 'vitest'
import { filterCollectionItems, parseCollection, workspaceSections } from './collectionsApi'
import type { WorkspaceCollection } from './collectionsApi'
const items=[{id:'a',name:'TD A'},{id:'b',name:'TD B'},{id:'c',name:'Sans classement'}]
const collections:WorkspaceCollection[]=[{id:'old',name:'L1',kind:'classrooms',yearStart:2017,archived:true,itemIds:['a']},{id:'new',name:'L1',kind:'classrooms',yearStart:2026,archived:false,itemIds:['b']}]
describe('Regroupements personnels',()=>{
 it('garde les espaces sans regroupement et sépare les archives',()=>{
  expect(filterCollectionItems(items,collections,'all','all','active','').map(i=>i.id)).toEqual(['b','c'])
  expect(filterCollectionItems(items,collections,'all','2017','archived','').map(i=>i.id)).toEqual(['a'])
  expect(filterCollectionItems(items,collections,'unassigned','all','active','').map(i=>i.id)).toEqual(['c'])
 })
 it('recherche les noms de regroupement et les noms de classe',()=>{
  expect(filterCollectionItems(items,collections,'all','all','all','L1').map(i=>i.id)).toEqual(['b','a'])
  expect(filterCollectionItems(items,collections,'all','all','all','TD B').map(i=>i.id)).toEqual(['b'])
 })
 it('présente les années récentes en premier sans dupliquer un espace',()=>{
  const sections=workspaceSections(items,[...collections,{...collections[1]!,id:'also',name:'Autre',itemIds:['b']}])
  expect(sections[0]!.collection!.yearStart).toBe(2026)
  expect(sections.flatMap(s=>s.items).map(i=>i.id).sort()).toEqual(['a','b','c'])
 })
 it('refuse une réponse au format incorrect',()=>{
  expect(parseCollection({id:'1',name:'L1',kind:'admin',year_start:2026,archived:false,item_ids:[]})).toBeNull()
 })
})
