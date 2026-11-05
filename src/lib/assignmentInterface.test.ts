import { describe, expect, it } from 'vitest'
import { assignmentViews, parseAssignmentInterface } from './assignmentInterface'
import { visibleViews } from './interfaceMode'
describe('Contrat des réglages d’exercice',()=>{
  it('accepte une ancienne réponse sans restriction explicite',()=>{
    expect(parseAssignmentInterface(undefined)).toBeNull()
    expect(parseAssignmentInterface(null)).toBeNull()
  })
  it('refuse une réponse ambiguë au lieu de proposer tous les outils',()=>{
    for(const views of [[],['admin'],['mcd','mcd'],{mcd:true}]) expect(parseAssignmentInterface({views,export_image:true,export_model:false})).toBeUndefined()
    expect(parseAssignmentInterface({views:['mcd'],export_image:true})).toBeUndefined()
    expect(parseAssignmentInterface({views:['mcd'],export_image:'false',export_model:false})).toBeUndefined()
  })
  it('permet au professeur de débloquer une vue avancée pour un débutant',()=>{
    const settings=parseAssignmentInterface({views:['dictionnaire','mcd','sql'],export_image:false,export_model:false})
    expect(visibleViews('beginner')).not.toContain('sql')
    expect(settings).toBeTruthy()
    expect(assignmentViews(settings!)).toContain('sql')
    expect(assignmentViews(settings!)).not.toContain('code')
  })
})
