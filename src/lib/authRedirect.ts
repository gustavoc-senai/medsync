// Preserve the verification tokens when Auth falls back to the site's root URL.
export function authCallbackPath(hash: string, pathname = ""): string | null {
  const type = new URLSearchParams(hash.replace(/^#/, "")).get("type");
  if (type === "invite") return "/aceitar-convite";
  if (type === "recovery") return pathname === "/aceitar-convite" ? "/aceitar-convite" : "/redefinir-senha";
  return null;
}

export function acceptedInvitationDestination(
  memberships: { organization_id: string; role: string }[],
  preferredOrganizationId: string | null,
) {
  const paths: Record<string, string> = {
    patient: "/paciente/dashboard",
    professional: "/profissional/dashboard",
    receptionist: "/recepcao/dashboard",
  };
  const portals = memberships.filter((member) => Object.hasOwn(paths, member.role));
  const member = portals.find((item) => item.organization_id === preferredOrganizationId) || portals[0];
  if (!member) throw new Error("O convite foi aceito, mas o perfil de acesso ainda não foi liberado. Peça à clínica para revisar seu vínculo.");
  return { organizationId: member.organization_id, path: paths[member.role] };
}
