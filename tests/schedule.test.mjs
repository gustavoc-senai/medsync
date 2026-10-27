import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'
const context={exports:{},URLSearchParams}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/schedule.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context)
const {filterAppointments,appointmentEndTime,appointmentQuery}=context.exports
const records=[
  {id:'p1',module:'pacientes',payload:{name:'Ana Souza'}},
  {id:'p2',module:'pacientes',payload:{name:'Carlos Silva'}},
  {id:'a',module:'consultas',payload:{patient_id:'p1',professional_id:'d1',starts_at:'2026-10-27T10:00',status:'Confirmada'}},
  {id:'b',module:'consultas',payload:{patient_id:'p2',professional_id:'d2',starts_at:'2026-10-27T09:00',status:'Cancelada'}},
  {id:'c',module:'consultas',payload:{patient_id:'p1',professional_id:'d1',starts_at:'2026-10-28T09:00',status:'Confirmada'}},
]
test('calendar combines date, professional, status and patient filters',()=>{
  assert.equal(filterAppointments(records,'2026-10-27','d1','Confirmada',' ANA ')[0].id,'a')
  assert.equal(filterAppointments(records,'2026-10-27','d2','Confirmada','').length,0)
  assert.equal(filterAppointments(records,'2026-10-27','','','').map(item=>item.id).join(','),'b,a')
  assert.equal(filterAppointments(records,'2026-10-27','','','Carlos')[0].payload.status,'Cancelada')
})
test('new appointment preserves selected day and professional',()=>{
  const params=new URLSearchParams(appointmentQuery('2026-10-27','doctor'))
  assert.equal(params.get('starts_at'),'2026-10-27T09:00')
  assert.equal(params.get('professional_id'),'doctor')
  assert.equal(new URLSearchParams(appointmentQuery('2026-10-27','')).has('professional_id'),false)
})
test('appointment end includes duration and rejects invalid values',()=>{
  assert.equal(appointmentEndTime('2026-10-27T09:00','45'),'09:45')
  assert.equal(appointmentEndTime('2026-10-27T09:00',''),'09:30')
  assert.equal(appointmentEndTime('invalid','30'),'')
  assert.equal(appointmentEndTime('2026-10-27T09:00','-10'),'')
  assert.equal(appointmentEndTime('2026-10-27T09:00','900'),'')
})
