"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User, Building2, ShieldCheck, Lock, Bell, Trash2,
  LogOut, ChevronRight, Upload, Globe, Phone, Mail,
  Clock, MapPin, Eye, EyeOff, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Section = "personal" | "verification" | "account" | "preferences" | "danger";

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "personal",     label: "Personal & Business", icon: User },
  { id: "verification", label: "Verification",        icon: ShieldCheck },
  { id: "account",      label: "Account Controls",    icon: Lock },
  { id: "preferences",  label: "Preferences",         icon: Bell },
  { id: "danger",       label: "Danger Zone",         icon: Trash2 },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [active, setActive] = useState<Section>("personal");
  const [saved, setSaved] = useState(false);

  const role = session?.user?.role;
  const isDealer = role === "dealer";

  function showSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="container max-w-5xl py-8 px-4">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-medium">Settings</h1>
          <p className="text-sm text-muted mt-1">Manage your account preferences and details</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <aside className="md:w-56 shrink-0">
            <nav className="flex md:flex-col gap-1">
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActive(id)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors text-left w-full",
                    active === id
                      ? "bg-accent/10 text-accent"
                      : "text-muted hover:text-foreground hover:bg-surface-2",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden md:block">{label}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {active === "personal"     && <PersonalSection isDealer={isDealer} session={session} onSave={showSaved} />}
            {active === "verification" && <VerificationSection />}
            {active === "account"      && <AccountSection onSave={showSaved} />}
            {active === "preferences"  && <PreferencesSection onSave={showSaved} />}
            {active === "danger"       && <DangerSection router={router} />}
          </div>
        </div>
      </div>

      {/* Toast */}
      {saved && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium shadow-xl animate-in fade-in-0 slide-in-from-bottom-4 duration-200">
          <Check className="h-4 w-4 text-emerald-400" />
          Changes saved
        </div>
      )}
    </div>
  );
}

/* ── Personal & Business ── */
function PersonalSection({
  isDealer,
  session,
  onSave,
}: {
  isDealer: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any;
  onSave: () => void;
}) {
  const [name,        setName]        = useState(session?.user?.name ?? "");
  const [email,       setEmail]       = useState(session?.user?.email ?? "");
  const [phone,       setPhone]       = useState("");
  const [company,     setCompany]     = useState("");
  const [description, setDescription] = useState("");
  const [website,     setWebsite]     = useState("");
  const [address,     setAddress]     = useState("");
  const [hours,       setHours]       = useState("");

  return (
    <Card title="Personal & Business">
      <div className="space-y-4">
        <Field label="Full name" icon={User}>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className={inputCls} placeholder="Your name" />
        </Field>
        <Field label="Email address" icon={Mail}>
          <input value={email} onChange={(e) => setEmail(e.target.value)}
            className={inputCls} placeholder="you@example.com" type="email" />
        </Field>
        <Field label="Phone number" icon={Phone}>
          <input value={phone} onChange={(e) => setPhone(e.target.value)}
            className={inputCls} placeholder="+254 7XX XXX XXX" />
        </Field>

        {isDealer && (
          <>
            <hr className="border-border" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Business details</p>
            <Field label="Company name" icon={Building2}>
              <input value={company} onChange={(e) => setCompany(e.target.value)}
                className={inputCls} placeholder="Your dealership name" />
            </Field>
            <Field label="Description">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={cn(inputCls, "h-auto resize-none py-2.5")}
                placeholder="Tell buyers about your dealership…" />
            </Field>
            <Field label="Website" icon={Globe}>
              <input value={website} onChange={(e) => setWebsite(e.target.value)}
                className={inputCls} placeholder="https://yoursite.com" type="url" />
            </Field>
            <Field label="Store address" icon={MapPin}>
              <input value={address} onChange={(e) => setAddress(e.target.value)}
                className={inputCls} placeholder="e.g. Westlands, Nairobi" />
            </Field>
            <Field label="Business hours" icon={Clock}>
              <input value={hours} onChange={(e) => setHours(e.target.value)}
                className={inputCls} placeholder="e.g. Mon–Fri 8am–6pm" />
            </Field>
          </>
        )}

        <div className="pt-2">
          <SaveButton onClick={onSave} />
        </div>
      </div>
    </Card>
  );
}

/* ── Verification ── */
function VerificationSection() {
  return (
    <Card title="Verification">
      <div className="space-y-5">
        <VerifyItem
          label="KRA PIN"
          description="Upload your KRA PIN certificate for identity verification."
          status="pending"
        />
        <VerifyItem
          label="Proof of address"
          description="A utility bill, bank statement, or lease agreement issued within 3 months."
          status="pending"
        />
        <VerifyItem
          label="Business registration"
          description="CAC, CR12, or equivalent business registration document."
          status="pending"
        />
      </div>
    </Card>
  );
}

function VerifyItem({
  label,
  description,
  status,
}: {
  label: string;
  description: string;
  status: "verified" | "pending" | "rejected";
}) {
  const colors = {
    verified: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    pending:  "bg-surface-2 text-muted",
    rejected: "bg-red-500/10 text-red-500",
  };
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-border bg-surface-2/50 p-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted mt-0.5">{description}</p>
        <span className={cn("inline-block mt-2 text-[10px] font-semibold capitalize rounded-full px-2.5 py-0.5", colors[status])}>
          {status}
        </span>
      </div>
      <label className="flex-shrink-0 cursor-pointer">
        <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png" />
        <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-2 transition-colors">
          <Upload className="h-3.5 w-3.5" />
          Upload
        </span>
      </label>
    </div>
  );
}

/* ── Account Controls ── */
function AccountSection({ onSave }: { onSave: () => void }) {
  const [showPass,    setShowPass]    = useState(false);
  const [current,    setCurrent]    = useState("");
  const [newPass,     setNewPass]     = useState("");
  const [confirm,    setConfirm]    = useState("");
  const [newPhone,   setNewPhone]   = useState("");
  const [newEmail,   setNewEmail]   = useState("");
  const [language,   setLanguage]   = useState("en");

  return (
    <Card title="Account Controls">
      <div className="space-y-6">
        {/* Language */}
        <Field label="Language" icon={Globe}>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
            <option value="en">English</option>
            <option value="sw">Swahili</option>
            <option value="fr">French</option>
          </select>
        </Field>

        {/* Change phone */}
        <Field label="New phone number" icon={Phone}>
          <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
            className={inputCls} placeholder="+254 7XX XXX XXX" />
        </Field>

        {/* Change email */}
        <Field label="New email address" icon={Mail}>
          <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
            className={inputCls} placeholder="newemail@example.com" type="email" />
        </Field>

        <hr className="border-border" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Change password</p>

        <Field label="Current password">
          <PasswordInput value={current} onChange={setCurrent} show={showPass} onToggle={() => setShowPass((v) => !v)} placeholder="Current password" />
        </Field>
        <Field label="New password">
          <PasswordInput value={newPass} onChange={setNewPass} show={showPass} onToggle={() => setShowPass((v) => !v)} placeholder="New password" />
        </Field>
        <Field label="Confirm new password">
          <PasswordInput value={confirm} onChange={setConfirm} show={showPass} onToggle={() => setShowPass((v) => !v)} placeholder="Confirm password" />
        </Field>

        <div className="pt-2">
          <SaveButton onClick={onSave} label="Update account" />
        </div>
      </div>
    </Card>
  );
}

function PasswordInput({
  value, onChange, show, onToggle, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        className={cn(inputCls, "pr-10")}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/* ── Preferences ── */
function PreferencesSection({ onSave }: { onSave: () => void }) {
  const [autoShare,        setAutoShare]        = useState(false);
  const [disableChats,     setDisableChats]     = useState(false);
  const [disableFeedback,  setDisableFeedback]  = useState(false);
  const [emailNotifs,      setEmailNotifs]      = useState(true);
  const [smsNotifs,        setSmsNotifs]        = useState(false);
  const [priceAlerts,      setPriceAlerts]      = useState(true);
  const [newMessages,      setNewMessages]      = useState(true);

  return (
    <Card title="Preferences">
      <div className="space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Listing behaviour</p>
        <Toggle label="Auto Ad Sharing" description="Automatically share new listings to social channels." checked={autoShare} onChange={setAutoShare} />
        <Toggle label="Disable Chats" description="Stop receiving chat messages from buyers." checked={disableChats} onChange={setDisableChats} />
        <Toggle label="Disable Feedback" description="Turn off the feedback widget on your listings." checked={disableFeedback} onChange={setDisableFeedback} />

        <hr className="border-border" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Notifications</p>
        <Toggle label="Email notifications" description="Receive updates and alerts via email." checked={emailNotifs} onChange={setEmailNotifs} />
        <Toggle label="SMS notifications" description="Get text alerts for new leads and messages." checked={smsNotifs} onChange={setSmsNotifs} />
        <Toggle label="Price drop alerts" description="Notify me when saved cars drop in price." checked={priceAlerts} onChange={setPriceAlerts} />
        <Toggle label="New message alerts" description="Instant notification for buyer enquiries." checked={newMessages} onChange={setNewMessages} />

        <div className="pt-2">
          <SaveButton onClick={onSave} label="Save preferences" />
        </div>
      </div>
    </Card>
  );
}

/* ── Danger Zone ── */
function DangerSection({ router }: { router: ReturnType<typeof useRouter> }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await fetch("/api/account/delete", { method: "DELETE" });
      await signOut({ callbackUrl: "/" });
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <Card title="Danger Zone">
      <div className="space-y-4">
        {/* Log out */}
        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-2/50 p-4">
          <div>
            <p className="text-sm font-medium">Log out</p>
            <p className="text-xs text-muted mt-0.5">Sign out of your account on this device.</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>

        {/* Delete account */}
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-sm font-medium text-red-500">Delete account</p>
          <p className="text-xs text-muted mt-0.5 mb-4">
            Permanently delete your account and all data. This cannot be undone.
          </p>
          {confirmDelete && (
            <p className="text-xs text-red-500 font-medium mb-3">
              Are you sure? Click the button again to confirm deletion.
            </p>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 rounded-full bg-red-500 text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Deleting…" : confirmDelete ? "Confirm delete" : "Delete account"}
          </button>
        </div>
      </div>
    </Card>
  );
}

/* ── Shared primitives ── */
const inputCls =
  "w-full h-11 rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none focus:border-accent transition-colors placeholder:text-muted";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="font-display text-lg font-medium mb-5">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label, icon: Icon, children,
}: {
  label: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
        {label}
      </label>
      {Icon ? (
        <div className="relative">
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          <div className="[&>*]:pl-9">{children}</div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function Toggle({
  label, description, checked, onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked ? "true" : "false"}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200",
          checked ? "bg-accent" : "bg-surface-2 border border-border",
        )}
      >
        <span
          className={cn(
            "absolute h-4.5 w-4.5 rounded-full bg-white shadow transition-transform duration-200",
            checked ? "translate-x-[22px]" : "translate-x-[2px]",
          )}
          style={{ height: "18px", width: "18px" }}
        />
      </button>
    </div>
  );
}

function SaveButton({ onClick, label = "Save changes" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 rounded-full bg-accent text-white px-7 text-sm font-semibold hover:opacity-90 transition-opacity"
    >
      {label}
    </button>
  );
}
