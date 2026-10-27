import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function reply(status: number, body: object) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
function invitationFailure(code: string) {
  if (code === 'email_exists' || code === 'user_already_exists') return 'Este e-mail já tem uma conta. O convite atual aceita somente novas contas; não exclua a conta existente.'
  if (code === 'email_address_not_authorized') return 'O Supabase recusou este destinatário. Confira se Custom SMTP está ativado e salvo.'
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'O limite de tentativas de envio foi atingido. Aguarde antes de tentar novamente.'
  if (code === 'unexpected_failure') return 'O serviço Auth falhou. Abra Authentication → Logs no Supabase e confira o erro desta tentativa; pode ser SMTP, template de e-mail ou criação do usuário no banco.'
  return 'O convite não foi enviado. Confira o código do erro e os registros de Authentication no Supabase.'
}
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return reply(405, { error: 'Método não permitido.' })
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const appUrl = Deno.env.get('APP_URL')
  if (!url || !key || !appUrl) return reply(503, { error: 'Configure APP_URL e as credenciais de servidor no ambiente da função.' })
  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1]
  if (!token) return reply(401, { error: 'Entre novamente para convidar usuários.' })
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: auth, error: authError } = await admin.auth.getUser(token)
  if (authError || !auth.user) return reply(401, { error: 'Sessão inválida ou expirada.' })
  let input: Record<string, unknown>
  try { input = await request.json() } catch { return reply(400, { error: 'Dados inválidos.' }) }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return reply(400, { error: 'Dados inválidos.' })
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const fullName = typeof input.full_name === 'string' ? input.full_name.trim() : ''
  const role = input.role
  const organizationId = input.organization_id
  if (typeof organizationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationId)
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || fullName.length < 2 || fullName.length > 120
    || !['patient','professional','receptionist'].includes(String(role))) return reply(400, { error: 'Confira nome, e-mail, clínica e perfil.' })
  const { data: memberships, error: memberError } = await admin.from('organization_members').select('role').eq('organization_id', organizationId).eq('user_id', auth.user.id)
  if (memberError) return reply(500, { error: 'Não foi possível verificar as permissões.' })
  if (!memberships?.some(m => ['owner','admin','administrator','super_admin'].includes(String(m.role).toLowerCase()))) return reply(403, { error: 'Somente administradores desta clínica podem convidar usuários.' })
  const { data: invitation, error: insertError } = await admin.from('medsync_invitations').insert({ organization_id: organizationId, email, full_name: fullName, role, invited_by: auth.user.id }).select('id').single()
  if (insertError) return reply(insertError.code === '23505' ? 409 : 500, { error: insertError.code === '23505' ? 'Já existe um convite pendente para este e-mail nesta clínica.' : 'Não foi possível registrar o convite. Confira a migração do banco.' })
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${appUrl.replace(/\/$/, '')}/aceitar-convite`, data: { full_name: fullName } })
  if (inviteError || !invited.user) {
    const code = inviteError?.code || 'invite_failed'
    const detail = inviteError?.message || 'O Auth não retornou o usuário convidado.'
    console.error('medsync_invitation_failed', { invitation_id: invitation.id, code, detail, status: inviteError?.status })
    const { error: trackingError } = await admin.from('medsync_invitations').update({ status: 'failed' }).eq('id', invitation.id)
    if (trackingError) console.error('medsync_invitation_tracking_failed', { invitation_id: invitation.id, code: trackingError.code })
    return reply(inviteError?.status === 429 ? 429 : 400, { error: `${invitationFailure(code)} Detalhe: ${code} — ${detail}`, code, detail })
  }
  const { error: updateError } = await admin.from('medsync_invitations').update({ status: 'sent', invited_user_id: invited.user.id }).eq('id', invitation.id)
  if (updateError) return reply(500, { error: 'O e-mail foi solicitado, mas o vínculo do convite não foi salvo. Contate o administrador antes de tentar novamente.' })
  return reply(200, { invitation_id: invitation.id, message: 'Convite enviado. O destinatário receberá um link para definir a senha.' })
})
