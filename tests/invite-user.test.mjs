import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../supabase/functions/invite-user/index.ts', import.meta.url), 'utf8').replace(/^\uFEFF?import .*\r?\n/, '')
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
const org = '11111111-1111-4111-8111-111111111111'
const input = { organization_id: org, email: 'person@example.com', full_name: 'Person Example', role: 'patient' }
function setup({ role = 'owner', validUser = true, duplicate = false, existingRole = 'patient', missingPending = false, sendFails = false, sendCode = 'unexpected_failure' } = {}) {
  let handler; const calls = []; const updates = []
  const admin = {
    auth: {
      getUser: async () => ({ data: { user: validUser ? { id: 'admin-id' } : null }, error: validUser ? null : new Error('invalid') }),
      admin: { inviteUserByEmail: async () => { calls.push('send'); return { data: { user: sendFails ? null : { id: 'invited-id' } }, error: sendFails ? Object.assign(new Error('send failed'), { code: sendCode, status: 500 }) : null } } },
    },
    from(table) {
      if (table === 'organization_members') {
        const q = { select() { return q }, eq() { return q }, then(resolve) { resolve({ data: [{ role }], error: null }) } }; return q
      }
      assert.equal(table, 'medsync_invitations')
      return {
        insert(payload) { calls.push('insert'); assert.equal(payload.organization_id, org); return { select() { return { single: async () => ({ data: duplicate ? null : { id: 'invite-id' }, error: duplicate ? { code: '23505' } : null }) } } } },
        select() {
          const q = { eq(column, value) { if (column === 'organization_id') assert.equal(value, org); if (column === 'email') assert.equal(value, input.email); return q }, in() { return q }, maybeSingle: async () => ({ data: missingPending ? null : { id: 'invite-id', full_name: input.full_name, role: existingRole }, error: null }) }; return q
        },
        update(payload) { updates.push(payload); const q = { eq() { return q }, in() { return q }, then(resolve) { resolve({ error: null }) } }; return q },
      }
    },
  }
  vm.runInNewContext(code, { exports: {}, console: { error() {} }, Response, Request, createClient: () => admin, Deno: { env: { get: key => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-only', APP_URL: 'https://app.example.com' })[key] }, serve: fn => { handler = fn } } })
  return { request: (body = input, authenticated = true) => handler(new Request('https://example.com', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: 'Bearer session' } : {}) }, body: JSON.stringify(body) })), calls, updates }
}
test('rejects missing and invalid sessions before any invitation', async () => {
  const absent = setup(); assert.equal((await absent.request(input, false)).status, 401); assert.deepEqual(absent.calls, [])
  const invalid = setup({ validUser: false }); assert.equal((await invalid.request()).status, 401); assert.deepEqual(invalid.calls, [])
})
test('non-admin membership cannot send invitations', async () => {
  const s = setup({ role: 'patient' }); assert.equal((await s.request()).status, 403); assert.deepEqual(s.calls, [])
})
test('cannot invite a new administrator through the endpoint', async () => {
  const s = setup(); assert.equal((await s.request({ ...input, role: 'admin' })).status, 400); assert.deepEqual(s.calls, [])
})
test('duplicate pending invitation resends email using the same invitation', async () => {
  const s = setup({ duplicate: true }); const response = await s.request(); assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.invitation_id, 'invite-id'); assert.match(body.message, /reenviado/); assert.deepEqual(s.calls, ['insert', 'send'])
})
test('resend failure preserves the existing invitation', async () => {
  const s = setup({ duplicate: true, sendFails: true }); assert.equal((await s.request()).status, 400); assert.deepEqual(s.updates, [])
})
test('resend cannot change the pending role', async () => {
  const s = setup({ duplicate: true, existingRole: 'professional' }); assert.equal((await s.request()).status, 409); assert.deepEqual(s.calls, ['insert'])
})
test('a conflict without a pending invitation does not send email', async () => {
  const s = setup({ duplicate: true, missingPending: true }); assert.equal((await s.request()).status, 409); assert.deepEqual(s.calls, ['insert'])
})
test('successful send records the invited user identity', async () => {
  const s = setup(); const response = await s.request(); assert.equal(response.status, 200); assert.equal((await response.json()).invitation_id, 'invite-id'); assert.deepEqual(s.calls, ['insert','send']); assert.equal(s.updates[0].invited_user_id, 'invited-id'); assert.equal(s.updates[0].status, 'sent')
})
test('send failure does not mark invitation sent', async () => {
  const s = setup({ sendFails: true }); assert.equal((await s.request()).status, 400); assert.equal(s.updates[0].status, 'failed')
})



test('exposes the Auth failure code instead of a generic message', async () => {
  const s = setup({ sendFails: true, sendCode: 'email_address_not_authorized' })
  const response = await s.request(); const body = await response.json()
  assert.equal(body.code, 'email_address_not_authorized')
  assert.match(body.error, /Custom SMTP/)
  assert.equal(body.detail, 'send failed')
})
test('existing account failure does not suggest deleting the user', async () => {
  const s = setup({ sendFails: true, sendCode: 'email_exists' })
  const body = await (await s.request()).json()
  assert.match(body.error, /não exclua a conta/)
})
