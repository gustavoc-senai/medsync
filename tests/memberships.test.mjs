import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'
const context={exports:{}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/memberships.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context)
const {mergeMemberships,selectMembership}=context.exports
test('combines administrative and invited clinics without dropping portal access',()=>{
  const members=mergeMemberships([{organization_id:'a',role:'OWNER'}],[{organization_id:'b',role:'patient',status:'active'}])
  assert.equal(members.length,2)
  assert.equal(selectMembership(members,'b').role,'patient')
  assert.equal(selectMembership(members,'a').role,'owner')
})
test('matching duplicate memberships resolve to one clinic',()=>{
  const members=mergeMemberships([{organization_id:'a',role:'professional'}],[{organization_id:'a',role:'professional',status:'active'}])
  assert.equal(members.length,1)
  assert.equal(selectMembership(members,'a').conflict,false)
})
test('conflicting roles never silently grant administrator access',()=>{
  const members=mergeMemberships([{organization_id:'a',role:'admin'}],[{organization_id:'a',role:'patient',status:'active'}])
  assert.throws(()=>selectMembership(members,'a'),/conflitantes/)
})
test('suspension blocks the selected clinic without blocking another active clinic',()=>{
  const members=mergeMemberships([{organization_id:'a',role:'owner'}],[{organization_id:'b',role:'patient',status:'suspended'}])
  assert.throws(()=>selectMembership(members,'b'),/suspenso/)
  assert.equal(selectMembership(members,'a').role,'owner')
})
test('a removed preference falls back to an active non-conflicting clinic',()=>{
  const members=mergeMemberships([],[{organization_id:'a',role:'patient',status:'suspended'},{organization_id:'b',role:'professional',status:'active'}])
  assert.equal(selectMembership(members,'removed').organization_id,'b')
  assert.equal(selectMembership([],''),null)
})
