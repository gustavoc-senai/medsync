import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../src/lib/authRedirect.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const context = { exports: {}, URLSearchParams }
vm.runInNewContext(code, context)
const { authCallbackPath } = context.exports
const { acceptedInvitationDestination } = context.exports
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/invitationStatus.ts', import.meta.url),'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
const { invitationStatus } = context.exports

test('invite callback goes to acceptance and recovery stays separate', () => {
  assert.equal(authCallbackPath('#access_token=test&type=invite'), '/aceitar-convite')
  assert.equal(authCallbackPath('#type=recovery&access_token=test'), '/redefinir-senha')
})
test('ordinary landing visits and signup callbacks are not invitations', () => {
  assert.equal(authCallbackPath(''), null)
  assert.equal(authCallbackPath('#type=signup'), null)
  assert.equal(authCallbackPath('#access_token=test'), null)
})
test('recovery links for unfinished invitations stay on the acceptance page', () => {
  assert.equal(authCallbackPath('#type=recovery', '/aceitar-convite'), '/aceitar-convite')
})

test('accepted patient and professional invitations open their own portals', () => {
  for (const [role, path] of [['patient', '/paciente/dashboard'], ['professional', '/profissional/dashboard'], ['receptionist', '/recepcao/dashboard']]) {
    const destination = acceptedInvitationDestination([{ organization_id: 'clinic', role }], null)
    assert.equal(destination.path, path)
    assert.equal(destination.organizationId, 'clinic')
  }
})
test('an invitation without a portal membership never falls back to administration', () => {
  assert.throws(() => acceptedInvitationDestination([], null), /perfil de acesso/)
  assert.throws(() => acceptedInvitationDestination([{ organization_id: 'clinic', role: 'admin' }], null), /perfil de acesso/)
})
test('preserves the selected clinic when the user has multiple portal memberships', () => {
  const destination = acceptedInvitationDestination([{ organization_id: 'a', role: 'professional' }, { organization_id: 'b', role: 'patient' }], 'b')
  assert.equal(destination.organizationId, 'b')
  assert.equal(destination.path, '/paciente/dashboard')
})
test('invitation lifecycle distinguishes cancellation, expiry, acceptance and released access', () => {
  const now=Date.parse('2026-10-27T12:00:00Z')
  assert.equal(invitationStatus({status:'sent',expires_at:'2026-10-26T00:00:00Z'},new Set(),now),'expired')
  assert.equal(invitationStatus({status:'failed',cancelled_at:'2026-10-26T00:00:00Z'},new Set(),now),'cancelled')
  assert.equal(invitationStatus({status:'accepted',expires_at:'2026-10-26T00:00:00Z'},new Set(),now),'accepted')
  assert.equal(invitationStatus({status:'accepted',invited_user_id:'patient'},new Set(['patient']),now),'access_ready')
})
