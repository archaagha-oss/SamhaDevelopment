import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { z } from "zod";
import {
  DetailPageLayout, DetailPageLoading, DetailPageNotFound,
} from "../components/layout";
import { Button } from "../components/ui/button";
import { useZodValidation } from "../lib/validation";
import {
  Member, Role, Status, EmpType,
  ROLE_CFG, STATUS_CFG, EMP_LABEL,
  Section, Field, inputCls,
} from "./team/shared";

function memberFormSchema(opts: { isEdit: boolean }) {
  const emailRule = z
    .string()
    .trim()
    .email("Enter a valid email like name@example.com");
  return z.object({
    name: z.string().trim().min(1, "Name is required"),
    email: opts.isEdit
      ? emailRule.optional().or(z.literal(""))
      : emailRule,
  });
}

// MemberEditPage — handles both `/team/new` (create) and `/team/:userId/edit` (edit).
// Replaces the old MemberFormModal popup. Same fields, no modal — full detail page.

export default function MemberEditPage() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const isEdit = !!userId;

  // Loaded data — only fetched when editing.
  const [member,     setMember]     = useState<Member | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading,    setLoading]    = useState(isEdit);
  const [loadError,  setLoadError]  = useState(false);

  // Form fields.
  const [name,           setName]           = useState("");
  const [email,          setEmail]          = useState("");
  const [phone,          setPhone]          = useState("");
  const [avatarUrl,      setAvatarUrl]      = useState("");
  const [jobTitle,       setJobTitle]       = useState("");
  const [managerId,      setManagerId]      = useState("");
  const [role,           setRole]           = useState<Role>("MEMBER");
  const [status,         setStatus]         = useState<Status>("ACTIVE");
  const [employeeId,     setEmployeeId]     = useState("");
  const [employmentType, setEmploymentType] = useState<EmpType | "">("");
  const [joinedAt,       setJoinedAt]       = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const validationSchema = useMemo(() => memberFormSchema({ isEdit }), [isEdit]);
  const { errors, validate, clearError } = useZodValidation(validationSchema);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const listRes = await axios.get("/api/users");
        if (cancelled) return;
        const list = Array.isArray(listRes.data) ? (listRes.data as Member[]) : [];
        setAllMembers(list);

        if (isEdit && userId) {
          const detailRes = await axios.get(`/api/users/${userId}`);
          if (cancelled) return;
          const m = detailRes.data as Member;
          setMember(m);
          setName(m.name || "");
          setEmail(m.email || "");
          setPhone(m.phone || "");
          setAvatarUrl(m.avatarUrl || "");
          setJobTitle(m.jobTitle || "");
          setManagerId(m.manager?.id || "");
          setRole(m.role);
          setStatus(m.status);
          setEmployeeId(m.employeeId || "");
          setEmploymentType((m.employmentType ?? "") as EmpType | "");
          setJoinedAt(m.joinedAt ? m.joinedAt.slice(0, 10) : "");
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isEdit, userId]);

  const managerCandidates = useMemo(
    () => allMembers.filter((u) => u.id !== member?.id && u.status !== "DEACTIVATED"),
    [allMembers, member?.id],
  );

  const cancelTo = isEdit && userId ? `/team/${userId}` : "/team";

  async function submit() {
    if (!validate({ name, email })) return;
    setSubmitError("");
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      name,
      role,
      status,
      phone:          phone          || null,
      avatarUrl:      avatarUrl      || null,
      jobTitle:       jobTitle       || null,
      managerId:      managerId      || null,
      employeeId:     employeeId     || null,
      employmentType: employmentType || null,
      joinedAt:       joinedAt       || null,
    };

    try {
      if (isEdit && userId) {
        await axios.patch(`/api/users/${userId}`, payload);
        toast.success("Member updated");
        navigate(`/team/${userId}`);
      } else {
        const r = await axios.post("/api/users", { ...payload, email });
        toast.success("Member created");
        const newId = r.data?.id;
        navigate(newId ? `/team/${newId}` : "/team");
      }
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || "Failed to save member");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <DetailPageLoading
        crumbs={[{ label: "Home", path: "/" }, { label: "Team", path: "/team" }, { label: "Edit" }]}
        title={isEdit ? "Editing member…" : "Create member"}
      />
    );
  }
  if (isEdit && (loadError || !member)) {
    return (
      <DetailPageNotFound
        crumbs={[{ label: "Home", path: "/" }, { label: "Team", path: "/team" }]}
        title="Member not found"
        message="This member could not be loaded. They may have been deleted."
        backLabel="Back to team"
        onBack={() => navigate("/team")}
      />
    );
  }

  const crumbs = isEdit && member
    ? [
        { label: "Home", path: "/" },
        { label: "Team", path: "/team" },
        { label: member.name, path: `/team/${member.id}` },
        { label: "Edit" },
      ]
    : [
        { label: "Home", path: "/" },
        { label: "Team", path: "/team" },
        { label: "New member" },
      ];

  return (
    <DetailPageLayout
      crumbs={crumbs}
      title={isEdit ? `Edit ${member?.name ?? "member"}` : "Create member"}
      subtitle={isEdit ? "Update the member's profile, role, and employment details." : "Add a new member to the team."}
      actions={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate(cancelTo)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create member"}
          </Button>
        </>
      }
      main={
        <>
          <div className="bg-card rounded-xl border border-border p-5 space-y-5">
            <Section title="Identity">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Full Name" required htmlFor="name" error={errors.name}>
                  <input
                    id="name"
                    name="name"
                    value={name}
                    onChange={(e) => { clearError("name"); setName(e.target.value); }}
                    placeholder="e.g. Sara Al Mansoori"
                    className={`${inputCls}${errors.name ? " border-destructive focus:ring-destructive" : ""}`}
                    aria-invalid={!!errors.name}
                  />
                </Field>
                <Field label="Email" required={!isEdit} htmlFor="email" error={errors.email}>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    disabled={isEdit}
                    onChange={(e) => { clearError("email"); setEmail(e.target.value); }}
                    placeholder="e.g. sara@samha.ae"
                    className={`${inputCls} ${isEdit ? "bg-muted/50 text-muted-foreground" : ""}${errors.email ? " border-destructive focus:ring-destructive" : ""}`}
                    aria-invalid={!!errors.email}
                  />
                </Field>
                <Field label="Phone">
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 50 000 0000" className={inputCls} />
                </Field>
                <Field label="Avatar URL">
                  <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className={inputCls} />
                </Field>
              </div>
            </Section>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 space-y-5">
            <Section title="Position">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Job Title">
                  <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Senior Sales Agent" className={inputCls} />
                </Field>
                <Field label="Reports To (Manager)">
                  <select value={managerId} onChange={(e) => setManagerId(e.target.value)} className={inputCls}>
                    <option value="">— None —</option>
                    {managerCandidates.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}{u.jobTitle ? ` · ${u.jobTitle}` : ""}</option>
                    ))}
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Role" required>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(Object.keys(ROLE_CFG) as Role[]).map((r) => {
                        const cfg = ROLE_CFG[r];
                        return (
                          <label
                            key={r}
                            title={cfg.description}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                              role === r ? "border-primary/40 bg-info-soft" : "border-border hover:border-border"
                            }`}
                          >
                            <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="hidden" />
                            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                            <span className="text-xs font-medium text-foreground">{cfg.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">{ROLE_CFG[role].description}</p>
                  </Field>
                </div>
              </div>
            </Section>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 space-y-5">
            <Section title="Employment">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Status">
                  <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className={inputCls}>
                    {(Object.keys(STATUS_CFG) as Status[]).map((s) => (
                      <option key={s} value={s}>{STATUS_CFG[s].label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Employment Type">
                  <select
                    value={employmentType}
                    onChange={(e) => setEmploymentType((e.target.value || "") as EmpType | "")}
                    className={inputCls}
                  >
                    <option value="">— None —</option>
                    {(Object.keys(EMP_LABEL) as EmpType[]).map((t) => (
                      <option key={t} value={t}>{EMP_LABEL[t]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Employee ID">
                  <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="EMP-001" className={inputCls} />
                </Field>
                <Field label="Joined Date">
                  <input type="date" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} className={inputCls} />
                </Field>
              </div>
            </Section>
          </div>

          {!isEdit && (
            <div className="bg-warning-soft border border-warning/30 rounded-lg px-4 py-2.5 text-xs text-warning">
              The user will be added to the system. Send them their login credentials separately via your authentication provider.
            </div>
          )}

          {submitError && (
            <div role="alert" className="bg-destructive-soft border border-destructive/30 rounded-lg px-4 py-2.5 text-sm text-destructive">
              {submitError}
            </div>
          )}
        </>
      }
    />
  );
}
