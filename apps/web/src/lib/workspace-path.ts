/** Build an absolute in-app path under /office or /system. */
export function workspaceHref(
  base: "office" | "system" | string,
  path: string,
): string {
  const slug = base.replace(/^\/+|\/+$/g, "");
  const tail = path.replace(/^\/+/, "");
  return `/${slug}/${tail}`;
}
