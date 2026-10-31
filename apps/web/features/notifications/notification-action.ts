/**
 * RFE-165: what a notification row does when tapped, decided from its `link` alone (the list endpoint
 * returns `title`/`message`/`link`/`type`, no event key or params).
 *   - `record`  `/animals?view=<id>&record=<key>[&ref=<id>]`: opens that animal's event form pre-filled.
 *   - `animal`  `/animals?view=<id>`: opens the workspace.
 *   - `list`    any other `/animals?...`: a grouped row, opens the filtered Animals list.
 *   - `link`    any other safe in-app path (e.g. `/tasks`).
 *   - `none`    no link, or an unsafe one: info only, no action.
 */
export type NotificationAction =
  | { kind: "record"; href: string; animalId: string; recordKey: string; ref: string | null }
  | { kind: "animal"; href: string; animalId: string }
  | { kind: "list"; href: string }
  | { kind: "link"; href: string }
  | { kind: "none" };

export function notificationAction(link: string | null | undefined): NotificationAction {
  if (!link) return { kind: "none" };
  // In-app absolute paths only: no external URLs, protocol-relative or backslash tricks.
  if (!link.startsWith("/") || link.startsWith("//") || link.includes("\\")) return { kind: "none" };
  const [path, query = ""] = link.split("?", 2);
  if (path !== "/animals") return { kind: "link", href: link };
  const params = new URLSearchParams(query);
  const animalId = params.get("view");
  const recordKey = params.get("record");
  if (animalId && recordKey) {
    return { kind: "record", href: link, animalId, recordKey, ref: params.get("ref") };
  }
  if (animalId) return { kind: "animal", href: link, animalId };
  return { kind: "list", href: link };
}
