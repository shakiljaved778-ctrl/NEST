/**
 * Console RBAC (section 11). Segregation of duties:
 * - product edits pack parameters and drafts copy, but cannot approve it;
 * - compliance approves copy and reads the customer-level audit, but cannot edit rules;
 * - the Sharia reviewer gives the final approval for Islamic copy, and only that;
 * - admin runs the platform (parameters, kill switches) but approves nothing;
 * - viewer reads dashboards, rules, copy and the compliance pack.
 * Kill switches stop harm, so product, compliance and admin can all use them.
 */
export const CONSOLE_ROLES = ["admin", "product", "compliance", "sharia", "viewer"] as const;
export type ConsoleRole = (typeof CONSOLE_ROLES)[number];

export const PERMISSIONS = {
  "dashboard:read": ["admin", "product", "compliance", "sharia", "viewer"],
  "packs:read": ["admin", "product", "compliance", "sharia", "viewer"],
  "packs:write": ["admin", "product"],
  "killswitch:write": ["admin", "product", "compliance"],
  "templates:read": ["admin", "product", "compliance", "sharia", "viewer"],
  "templates:write": ["product"],
  "templates:approve": ["compliance"],
  "templates:sharia": ["sharia"],
  "audit:read": ["admin", "compliance"],
  "audit:export": ["compliance"],
  "complaints:read": ["compliance"],
  "compliance:read": ["admin", "product", "compliance", "sharia", "viewer"],
} as const satisfies Record<string, readonly ConsoleRole[]>;
export type Permission = keyof typeof PERMISSIONS;

export function can(role: ConsoleRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly ConsoleRole[]).includes(role);
}

/** Everything a role may do (the console shows only what the user can use). */
export function permissionsOf(role: ConsoleRole): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(role, p));
}
