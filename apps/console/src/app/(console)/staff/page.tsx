import { Badge } from "@amil/ui";
import { PageHeader, Panel, Section } from "@/components/page-header";
import { AddStaff, StaffActions } from "@/components/staff-editor";
import { adminGet } from "@/lib/api";
import { fmtDate, ROLE_LABELS } from "@/lib/labels";
import { can, requirePermission } from "@/lib/session";
import type { StaffMember } from "@/lib/types";

/** Who may sign in to the console, and with which role (D-077, D-081). */
export default async function StaffPage() {
  const me = await requirePermission("staff:read");
  const canWrite = can(me, "staff:write");
  const { staff } = await adminGet<{ staff: StaffMember[] }>("/staff");
  return (
    <>
      <PageHeader
        title="Staff"
        description="Who may sign in to the console, and what they may do. Okta proves who someone is; their role here decides what they can do. Changes apply at once and are kept in the console activity log. Admins change everyone's access but their own, and the bank always keeps an active compliance officer."
      />
      {canWrite ? (
        <Section title="Add a person">
          <Panel>
            <AddStaff />
          </Panel>
        </Section>
      ) : null}
      <Panel className="p-0">
        <table className="data" data-testid="staff">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Since</th>
              {canWrite ? <th>Change</th> : null}
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} data-email={s.email} className={s.active ? undefined : "opacity-60"}>
                <td className="text-sm">
                  {s.name} {s.active ? null : <Badge tone="neutral">deactivated</Badge>}
                </td>
                <td className="text-xs">{s.email}</td>
                <td className="text-xs">{ROLE_LABELS[s.role]?.title ?? s.role}</td>
                <td className="text-xs whitespace-nowrap">{fmtDate(s.createdAt)}</td>
                {canWrite ? (
                  <td>
                    <StaffActions
                      id={s.id}
                      name={s.name}
                      role={s.role}
                      active={s.active}
                      self={s.id === me.user.id}
                    />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
