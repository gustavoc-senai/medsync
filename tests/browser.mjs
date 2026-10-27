import {
  chromium,
  expect,
} from "../.tmp/validation/node_modules/@playwright/test/index.mjs";
import fs from "node:fs";
const origin = "http://localhost:5174";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const errors = [];
const invitationRequests = [];
const org = "11111111-1111-4111-8111-111111111111";
const secondOrg = "33333333-3333-4333-8333-333333333333";
const uid = "22222222-2222-4222-8222-222222222222";
const rec = (id, module, payload) => ({
  id,
  organization_id: org,
  module,
  payload,
  created_at: new Date().toISOString(),
});
const today = new Date();
const day = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0"),
].join("-");
const patients = Array.from({ length: 14 }, (_, i) =>
  rec(`p${i}`, "pacientes", {
    name: `Paciente demonstrativo ${String(i + 1).padStart(2, "0")}`,
    email: `pessoa${i}@example.com`,
    status: "Ativo",
  }),
);
const professionals = [
  rec("doc1", "profissionais", {
    name: "Profissional demonstrativo",
    specialty: "Clínica geral",
    status: "Ativo",
  }),
];
const consultations = Array.from({ length: 5 }, (_, i) =>
  rec(`a${i}`, "consultas", {
    patient_id: `p${i}`,
    professional_id: "doc1",
    starts_at: `${day}T${String(8 + i).padStart(2, "0")}:30`,
    status: ["Confirmada", "Em espera", "Agendada", "Concluída", "Confirmada"][
      i
    ],
  }),
);
const records = [
  ...patients,
  ...professionals,
  ...consultations,
  rec("payment1", "pagamentos", {
    name: "Consulta demonstrativa",
    patient_id: "p0",
    date: day,
    amount: "250",
    status: "Pago",
  }),
];
const invitations = Array.from({ length: 9 }, (_, i) => ({
  id: `inv${i}`,
  email: `convidado${i}@example.com`,
  full_name: `Usuário demonstrativo ${i + 1}`,
  role: i % 2 ? "professional" : "patient",
  status: ["sent", "accepted", "failed"][i % 3],
  created_at: new Date().toISOString(),
}));
async function contextFor(role = "owner", mixed = false) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const user = {
    id: uid,
    aud: "authenticated",
    role: "authenticated",
    email: "gestor@example.com",
    email_confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: "email" },
    user_metadata: { full_name: "Gestor demonstrativo" },
  };
  const payload = Buffer.from(
    JSON.stringify({
      sub: uid,
      exp: Math.floor(Date.now() / 1000) + 3600,
      role: "authenticated",
    }),
  ).toString("base64url");
  const token = `e30.${payload}.test`;
  const session = {
    access_token: token,
    refresh_token: "mock-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  };
  const env = fs.readFileSync(".env.local", "utf8");
  const project =
    env.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "wuwmmsuebnwefubzcjob";
  await context.addInitScript(
    ({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session));
    },
    { key: `sb-${project}-auth-token`, session },
  );
  await context.route("**/*.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body = [];
    if (path.endsWith("/auth/v1/user")) body = user;
    else if (path.endsWith("/auth/v1/token")) body = session;
    else if (path.endsWith("/organization_members"))
      body =
        role === "owner" ? [{ organization_id: org, user_id: uid, role }] : [];
    else if (path.endsWith("/medsync_memberships"))
      body = mixed ? [{ organization_id: secondOrg, user_id: uid, role: "professional", status: "active" }] : role === "owner" && !url.searchParams.has("user_id")
        ? [{ organization_id: org, user_id: "patient-user", role: "patient", status: "active" }]
        : [{ organization_id: org, user_id: uid, role, status: "active" }];
    else if (path.endsWith("/organizations"))
      body = url.searchParams.get("id")?.startsWith("in.")
        ? [{ id: org, name: "Clínica demonstrativa" }, ...(mixed ? [{ id: secondOrg, name: "Segunda clínica" }] : [])]
        : { id: org, name: "Clínica demonstrativa" };
    else if (path.endsWith("/clinic_units"))
      body = [
        { id: "unit1", name: "Unidade principal" },
        { id: "unit2", name: "Unidade centro" },
      ];
    else if (path.endsWith("/medsync_records"))
      body =
        role === "patient"
          ? records.filter(
              (r) => r.id === "p0" || r.payload.patient_id === "p0",
            )
          : records;
    else if (path.endsWith("/medsync_invitations")) body = invitations;
    else if (path.endsWith("/medsync_portal_links"))
      body = [{ record_id: role === "professional" ? "doc1" : "p0" }];
    else if (path.endsWith("/rpc/medsync_portal_catalog")) body = professionals;
    else if (path.endsWith("/rpc/medsync_list_portal_users"))
      body = [
        {
          user_id: "patient-user",
          email: "paciente@example.com",
          full_name: "Paciente demonstrativo",
          role: "patient",
          record_id: "p0",
        },
      ];
    else if (path.includes("/functions/")) {
      invitationRequests.push(route.request().postDataJSON());
      return route.fulfill({
        status: 500,
        json: { error: "Envio bloqueado no teste: nenhum e-mail foi enviado." },
      });
    }
    else if (path.includes("/rpc/")) body = null;
    return route.fulfill({
      status: 200,
      json: body,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page };
}
const { context, page } = await contextFor();
await page.goto(origin + "/app/dashboard");
await expect(
  page.getByRole("heading", { name: "Visão geral", exact: true }),
).toBeVisible();
await page.screenshot({
  path: ".tmp/screenshots/dashboard-desktop.png",
  fullPage: true,
});
await page.getByRole("button", { name: "Ir para uma página..." }).click();
await page.getByRole("textbox", { name: "Buscar página" }).fill("fluxo");
await expect(
  page.getByRole("link", { name: "Fluxo de caixa", exact: true }).last(),
).toBeVisible();
await page.keyboard.press("Escape");
await page.goto(origin + "/app/usuarios");
await expect(
  page.getByRole("heading", { name: "Convidar usuário", exact: true }),
).toBeVisible();
await page.getByRole("button", { name: "Reenviar convite para Usuário demonstrativo 1", exact: true }).click();
await expect(page.getByRole("alert")).toContainText("Envio bloqueado no teste");
await page.getByRole("searchbox", { name: "Buscar usuário" }).fill("inexistente");
await expect(page.getByText("Nenhum usuário encontrado com esses filtros.")).toBeVisible();
await page.getByRole("searchbox", { name: "Buscar usuário" }).fill("");
await page.getByRole("checkbox", { name: "Apenas aguardando vínculo" }).check();
await expect(page.getByText("Nenhum usuário encontrado com esses filtros.")).toBeVisible();
await page.getByRole("checkbox", { name: "Apenas aguardando vínculo" }).uncheck();
await page.goto(origin + "/app/pacientes/novo?name=Paciente%20Convidado&email=convidado%40example.com&returnTo=usuarios");
await expect(page.getByRole("textbox", { name: /^Nome/ })).toHaveValue("Paciente Convidado");
await expect(page.getByRole("textbox", { name: "E-mail", exact: true })).toHaveValue("convidado@example.com");
await page.getByRole("textbox", { name: /^Nome/ }).fill("Alteração não salva");
await page.getByRole("link", { name: "Cancelar", exact: true }).click();
await expect(page.getByRole("alertdialog")).toBeVisible();
await page.getByRole("button", { name: "Continuar editando", exact: true }).click();
await expect(page.getByRole("textbox", { name: /^Nome/ })).toHaveValue("Alteração não salva");
await page.getByRole("link", { name: "Cancelar", exact: true }).click();
await page.getByRole("button", { name: "Descartar e sair", exact: true }).click();
await expect(page).toHaveURL(origin + "/app/pacientes");
await page.goto(origin + "/app/pacientes/p0");
await page.getByRole("button", { name: "Convidar para o portal", exact: true }).click();
await expect(page.getByRole("alert")).toContainText("Envio bloqueado no teste");
expect(invitationRequests.at(-1)).toMatchObject({ record_id: "p0", role: "patient", email: "pessoa0@example.com" });
await page.goto(origin + "/app/usuarios");
await page.screenshot({
  path: ".tmp/screenshots/users-desktop.png",
  fullPage: true,
});
await page
  .getByRole("textbox", { name: "Buscar convites" })
  .fill("inexistente");
await expect(
  page.getByRole("heading", { name: "Nenhum convite encontrado" }),
).toBeVisible();
await page.goto(origin + "/app/pacientes");
await expect(page.getByText("1–10 de 14 registros")).toBeVisible();
await page.getByRole("button", { name: "Próxima página" }).click();
await expect(page.getByText("11–14 de 14 registros")).toBeVisible();
for (const path of [
  "minha-clinica",
  "seguranca",
  "relatorios-atendimentos",
  "relatorios-financeiro",
  "fluxo-caixa",
]) {
  await page.goto(origin + "/app/" + path);
  await expect(page.locator("main h1")).toBeVisible();
}
await page.goto(origin + "/app/agenda");
await expect(page.locator(".calendar-week button")).toHaveCount(7);
await page.getByRole("button", { name: "Próxima semana" }).click();
await expect(page.locator(".calendar-week button")).toHaveCount(7);
await page.getByLabel("Ir para a data", { exact: true }).fill(day);
await page.getByRole("combobox", { name: "Filtrar por profissional", exact: true }).selectOption("doc1");
await page.getByRole("searchbox", { name: "Buscar paciente", exact: true }).fill("inexistente");
await expect(page.getByText("Não há consultas com os filtros selecionados.")).toBeVisible();
await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
await page.getByRole("combobox", { name: "Filtrar por profissional", exact: true }).selectOption("doc1");
await page.getByRole("link", { name: "Agendar nesta data", exact: true }).click();
await expect(page.locator('input[name="starts_at"]')).toHaveValue(day + "T09:00");
await expect(page.getByRole("combobox", { name: /^Profissional/ })).toHaveValue("doc1");
await expect(page.getByRole("combobox", { name: "Situação", exact: true })).toHaveValue("Agendada");
await expect(page.getByRole("spinbutton", { name: /^Duração em minutos/ })).toHaveValue("30");
await page.goto(origin + "/app/agenda");
await page.screenshot({
  path: ".tmp/screenshots/calendar-desktop.png",
  fullPage: true,
});
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(origin + "/app/usuarios");
await expect(
  page.getByRole("button", { name: "Abrir navegação" }),
).toBeVisible();
await page.getByRole("button", { name: "Abrir navegação" }).click();
await expect(page.locator("dialog.mobile-navigation")).toBeVisible();
await page.keyboard.press("Escape");
await page.screenshot({
  path: ".tmp/screenshots/users-mobile.png",
  fullPage: true,
});
await expect
  .poll(() =>
    page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  )
  .toBeTruthy();
await page.goto(origin + "/");
await expect(page.locator(".hero-photo img")).toBeVisible();
await page.screenshot({
  path: ".tmp/screenshots/landing-mobile.png",
  fullPage: true,
});
await expect
  .poll(() =>
    page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  )
  .toBeTruthy();
await page.setViewportSize({ width: 1440, height: 1000 });
await page.screenshot({
  path: ".tmp/screenshots/landing-desktop.png",
  fullPage: true,
});
await page.goto(origin + "/login");
await page.screenshot({
  path: ".tmp/screenshots/login-desktop.png",
  fullPage: true,
});
await context.close();
for (const role of ["patient", "professional", "receptionist"]) {
  const { context, page } = await contextFor(role);
  await page.goto(origin + "/app/dashboard");
  const prefix =
    role === "patient"
      ? "paciente"
      : role === "professional"
        ? "profissional"
        : "recepcao";
  await expect(page).toHaveURL(new RegExp("/" + prefix + "/dashboard"));
  await page.goto(origin + "/onboarding");
  await expect(page).toHaveURL(new RegExp("/" + prefix + "/dashboard"));
  await expect(page.getByRole("heading", { name: role === "patient" ? "Suas próximas consultas" : "Próximos atendimentos", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Atualizar meus dados", exact: true }).click();
  await expect(page.locator("main h1")).toBeVisible();
  await page.screenshot({
    path: `.tmp/screenshots/${role}-desktop.png`,
    fullPage: true,
  });
  await page.goto(
    origin +
      "/" +
      prefix +
      "/" +
      (role === "patient"
        ? "consultas"
        : role === "professional"
          ? "prontuario"
          : "pacientes"),
  );
  await expect(page.locator("main h1")).toBeVisible();
  if (role === "patient") {
    await page.getByLabel("Filtrar data", { exact: true }).fill("2099-12-31");
    await expect(page.locator("tbody tr")).toHaveCount(0);
    await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "/" + prefix + "/dashboard");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: `.tmp/screenshots/${role}-mobile.png`, fullPage: true });
  await context.close();
}
const mixedAccount = await contextFor("owner", true);
await mixedAccount.page.goto(origin + "/app/pacientes/novo");
await mixedAccount.page.getByRole("textbox", { name: /^Nome/ }).fill("Cadastro não salvo");
mixedAccount.page.once("dialog", dialog => dialog.dismiss());
await mixedAccount.page.getByRole("combobox", { name: "Selecionar clínica", exact: true }).selectOption(secondOrg);
await expect(mixedAccount.page).toHaveURL(origin + "/app/pacientes/novo");
await expect(mixedAccount.page.getByRole("textbox", { name: /^Nome/ })).toHaveValue("Cadastro não salvo");
mixedAccount.page.once("dialog", dialog => dialog.accept());
await mixedAccount.page.getByRole("combobox", { name: "Selecionar clínica", exact: true }).selectOption(secondOrg);
await expect(mixedAccount.page).toHaveURL(origin + "/profissional/dashboard");
await mixedAccount.page.getByRole("combobox", { name: "Selecionar clínica", exact: true }).selectOption(org);
await expect(mixedAccount.page).toHaveURL(origin + "/app/dashboard");
await mixedAccount.context.close();
await browser.close();
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  "OK: desktop/mobile, navigation, search, pagination, reports, authentication layout and all three portals. All Supabase calls mocked; no email sent.",
);
