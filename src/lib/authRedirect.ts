// Preserve the verification tokens when Auth falls back to the site's root URL.
export function authCallbackPath(hash: string): string | null {
  const type = new URLSearchParams(hash.replace(/^#/, "")).get("type");
  if (type === "invite") return "/aceitar-convite";
  if (type === "recovery") return "/redefinir-senha";
  return null;
}
