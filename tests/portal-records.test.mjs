import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'
const context={exports:{}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/portalRecords.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context)
const {upcomingAppointments,formatPortalDate}=context.exports
test('portal highlights future appointments and today waiting/in progress without cancelled/completed entries',()=>{
  const appointment=(id,time,status)=>({id,module:'consultas',created_at:'2026-10-27T00:00:00',payload:{starts_at:time,status}})
  const records=[appointment('future','2026-10-28T10:00','Agendada'),appointment('waiting','2026-10-27T08:00','Em espera'),appointment('past','2026-10-26T08:00','Em espera'),appointment('cancelled','2026-10-28T08:00','Cancelada'),appointment('complete','2026-10-28T09:00','Concluída'),appointment('invalid','invalid','Agendada')]
  assert.equal(upcomingAppointments(records,new Date('2026-10-27T12:00').getTime()).map(item=>item.id).join(','),'waiting,future')
})
test('portal dates use Brazilian formatting and keep date-only values on the original day',()=>{
  assert.equal(formatPortalDate('2026-10-27'),'27/10/2026')
  assert.match(formatPortalDate('2026-10-27T14:30',true),/27\/10\/2026.*14:30/)
  assert.equal(formatPortalDate('invalid'),'Data não informada')
})
