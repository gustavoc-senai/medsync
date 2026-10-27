import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../supabase/functions/invite-user/index.ts', import.meta.url), 'utf8').replace(/^\uFEFF?import .*\r?\n/, '')
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
const org = '11111111-1111-4111-8111-111111111111'
const input = { organization_id: org, email: 'person@example.com', full_name: 'Person Example', role: 'patient' }
function setup({ role = 'owner', validUser = true, duplicate = false, existingRole = 'patient', missingPending = false, sendFails = false, sendCode = 'unexpected_failure', confirmedRecipient = false, recoveryFails = false, trackingFails = false } = {}) {
  let handler; const calls = []; const updates = []
  const admin = {
    auth: {
      getUser: async () => ({ data: { user: validUser ? { id: 'admin-id' } : null }, error: validUser ? null : new Error('invalid') }),
      resetPasswordForEmail: async (_email, options) => { calls.push('recover'); assert.match(options.redirectTo, /aceitar-convite\?convite=invite-id$/); return { error: recoveryFails ? Object.assign(new Error('recovery failed'), { code: 'over_email_send_rate_limit', status: 429 }) : null } },
      admin: {
        getUserById: async () => ({ data: { user: { id: 'invited-id', email: input.email } }, error: null }),
        inviteUserByEmail: async (_email, options) => { calls.push('send'); assert.match(options.redirectTo, /aceitar-convite\?convite=invite-id$/); return { data: { user: sendFails ? null : { id: 'invited-id' } }, error: sendFails ? Object.assign(new Error('send failed'), { code: sendCode, status: 500 }) : null } },
      },
    },
    from(table) {
      if (table === 'organization_members') {
        const q = { select() { return q }, eq() { return q }, then(resolve) { resolve({ data: [{ role }], error: null }) } }; return q
      }
      throw new Error(`Unexpected direct table access: ${table}`)
    },
    async rpc(name, payload) {
      if (name === 'medsync_prepare_invitation') {
        calls.push('prepare'); assert.equal(payload.p_actor, 'admin-id'); assert.equal(payload.p_organization_id, org)
        return { data: missingPending || existingRole !== input.role ? null : { id: 'invite-id', resend: duplicate, invited_user_id: confirmedRecipient ? 'invited-id' : null }, error: missingPending || existingRole !== input.role ? { message: 'Convite incompatível' } : null }
      }
      assert.equal(name, 'medsync_finish_invitation'); updates.push(payload)
      return { error: trackingFails ? { code: 'tracking_error' } : null }
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
  const s = setup({ duplicate: true }); const response = await s.request(); assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.invitation_id, 'invite-id'); assert.match(body.message, /reenviado/); assert.deepEqual(s.calls, ['prepare', 'send'])
})
test('resend failure preserves the existing invitation', async () => {
  const s = setup({ duplicate: true, sendFails: true }); assert.equal((await s.request()).status, 400); assert.equal(s.updates[0].p_success, false)
})
test('resend cannot change the pending role', async () => {
  const s = setup({ duplicate: true, existingRole: 'professional' }); assert.equal((await s.request()).status, 409); assert.deepEqual(s.calls, ['prepare'])
})
test('a conflict without a pending invitation does not send email', async () => {
  const s = setup({ duplicate: true, missingPending: true }); assert.equal((await s.request()).status, 409); assert.deepEqual(s.calls, ['prepare'])
})
test('successful send records the invited user identity', async () => {
  const s = setup(); const response = await s.request(); assert.equal(response.status, 200); assert.equal((await response.json()).invitation_id, 'invite-id'); assert.deepEqual(s.calls, ['prepare','send']); assert.equal(s.updates[0].p_user_id, 'invited-id'); assert.equal(s.updates[0].p_success, true)
})
test('send failure does not mark invitation sent', async () => {
  const s = setup({ sendFails: true }); assert.equal((await s.request()).status, 400); assert.equal(s.updates[0].p_success, false)
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
test('a verified recipient can finish an existing invitation through recovery', async () => {
  const s = setup({ duplicate: true, confirmedRecipient: true, sendFails: true, sendCode: 'email_exists' })
  assert.equal((await s.request()).status, 200)
  assert.deepEqual(s.calls, ['prepare','send','recover'])
  assert.equal(s.updates[0].p_user_id, 'invited-id')
})
test('recovery rate limits are returned without recording a successful email', async () => {
  const s = setup({ confirmedRecipient: true, sendFails: true, sendCode: 'email_exists', recoveryFails: true })
  assert.equal((await s.request()).status, 429)
  assert.equal(s.updates[0].p_success, false)
})
test('tracking failures are not reported as successful invitations', async () => {
  const s = setup({ trackingFails: true })
  assert.equal((await s.request()).status, 500)
})
