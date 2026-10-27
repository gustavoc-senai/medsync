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

test('invite callback goes to acceptance and recovery stays separate', () => {
  assert.equal(authCallbackPath('#access_token=test&type=invite'), '/aceitar-convite')
  assert.equal(authCallbackPath('#type=recovery&access_token=test'), '/redefinir-senha')
})
test('ordinary landing visits and signup callbacks are not invitations', () => {
  assert.equal(authCallbackPath(''), null)
  assert.equal(authCallbackPath('#type=signup'), null)
  assert.equal(authCallbackPath('#access_token=test'), null)
})
