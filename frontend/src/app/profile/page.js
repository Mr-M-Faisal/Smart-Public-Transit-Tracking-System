"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, BadgeCheck, Camera, CheckCircle2, ChevronRight, Eye, EyeOff, KeyRound, LockKeyhole, LogOut, Mail, Pencil, Phone, ShieldCheck, UserRound, X } from "lucide-react";
import { Navbar } from "../../components/navigation/Navbar";
import { Footer } from "../../components/navigation/Footer";
import { ProtectedPage } from "../../components/common/ProtectedPage";
import { Button } from "../../components/common/Button";
import { clearAccessToken } from "../../lib/auth/token";
import { changePassword, updateProfile } from "../../services/authService";

const MAX_IMAGE_BYTES = 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ProfilePage() {
  return <div className="profile-page min-h-screen bg-[var(--background)]"><Navbar /><main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10"><ProtectedPage>{(user) => <Profile user={user} />}</ProtectedPage></main><Footer /></div>;
}

function Profile({ user }) {
  const router = useRouter();
  const [profile, setProfile] = useState(user);
  const [dialog, setDialog] = useState("");
  const [draft, setDraft] = useState({ name: user.name || "", phone: user.phone || "" });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(user.profileImage || "");
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showPasswords, setShowPasswords] = useState({ current: false, next: false, confirm: false });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => () => { if (preview.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);

  const initials = profile.name?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "SS";
  const accountLabel = profile.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : "Passenger";

  function closeDialog() {
    setDialog(""); setFormError(""); setPhoto(null); setPreview(profile.profileImage || ""); setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
  }

  function openEdit() {
    setDraft({ name: profile.name || "", phone: profile.phone || "" });
    setPhoto(null); setPreview(profile.profileImage || ""); setFormError(""); setDialog("edit");
  }

  function selectPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) { setFormError("Choose a JPEG, PNG, or WebP image."); return; }
    if (file.size > MAX_IMAGE_BYTES) { setFormError("Profile images must be 1 MB or smaller."); return; }
    setFormError(""); setPhoto(file); setPreview(URL.createObjectURL(file));
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!draft.name.trim()) { setFormError("Enter your name."); return; }
    setBusy(true); setFormError("");
    try {
      const values = { name: draft.name.trim(), phone: draft.phone.trim() };
      if (photo) values.profileImage = await fileToDataUrl(photo);
      const saved = await updateProfile(values);
      setProfile(saved); setNotice("Profile updated successfully."); closeDialog();
    } catch (error) { setFormError(error.response?.data?.message || "Unable to save your profile. Please try again."); }
    finally { setBusy(false); }
  }

  async function savePassword(event) {
    event.preventDefault();
    if (!passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword) { setFormError("Complete all password fields."); return; }
    if (passwords.newPassword.length < 6) { setFormError("Your new password must contain at least 6 characters."); return; }
    if (passwords.newPassword !== passwords.confirmPassword) { setFormError("New passwords do not match."); return; }
    setBusy(true); setFormError("");
    try { await changePassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }); setNotice("Password changed successfully."); closeDialog(); }
    catch (error) { setFormError(error.response?.data?.message || "Unable to change your password. Please try again."); }
    finally { setBusy(false); }
  }

  function logout() { clearAccessToken(); router.replace("/"); }

  return (
    <>
      <section className="profile-card overflow-hidden rounded-[2rem] border border-[var(--glass-border)]">
        <header className="profile-hero relative overflow-hidden px-5 py-6 sm:px-8 sm:py-8">
          <div className="profile-hero-pattern" aria-hidden="true" />
          <div className="relative z-10">
            <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--primary-ink)]">
              <ShieldCheck size={15} /> Smart Safar account
            </p>
            <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                <ProfileAvatar src={profile.profileImage} initials={initials} size="large" />
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-3xl">{profile.name}</h1>
                  <p className="mt-1 truncate text-sm text-[var(--muted)]">{profile.email}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--primary-border)] bg-white/75 px-2.5 py-1 text-xs font-bold text-[var(--primary-ink)] backdrop-blur-sm">
                    <BadgeCheck size={14} /> {accountLabel} account
                  </span>
                </div>
              </div>
              <Button type="button" className="min-h-11 gap-2 self-start px-5 sm:self-auto" onClick={openEdit}>
                <Pencil size={16} /> Edit profile
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]">
          <section className="profile-details-panel">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--primary-ink)]">Personal details</p>
              <h2 className="mt-1 text-xl font-bold text-[var(--foreground)]">Your travel profile</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Keep your contact details current for a smoother journey.</p>
            </div>
            {notice && <div className="profile-notice mt-5 flex items-start gap-2 rounded-xl px-3 py-3 text-sm" role="status"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />{notice}<button type="button" onClick={() => setNotice("")} className="ml-auto rounded-lg p-1" aria-label="Dismiss message"><X size={15} /></button></div>}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Detail icon={Mail} label="Email address" value={profile.email} />
              <Detail icon={Phone} label="Phone number" value={profile.phone || "Not added"} />
              <Detail icon={UserRound} label="Account type" value={accountLabel} />
              <Detail icon={ShieldCheck} label="Sign-in protection" value={profile.googleConnected ? "Google connected" : "Password protected"} />
            </div>
          </section>

          <aside className="profile-security-card rounded-2xl border border-[var(--border)] p-5">
            <span className="profile-security-icon grid h-11 w-11 place-items-center rounded-2xl"><KeyRound size={19} /></span>
            <h2 className="mt-4 text-lg font-bold text-[var(--foreground)]">Account & security</h2>
            <Link href="/settings" className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-[var(--primary-ink)]">Theme settings <ChevronRight size={16} /></Link>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Manage how you access Smart Safar.</p>
            <button type="button" onClick={() => { setFormError(""); setDialog("password"); }} className="profile-security-action mt-5 flex min-h-12 w-full items-center justify-between rounded-xl border border-[var(--border)] px-3.5 text-left text-sm font-semibold text-[var(--foreground)]">
              <span className="inline-flex items-center gap-2"><LockKeyhole size={16} className="text-[var(--primary-ink)]" />Change password</span><ChevronRight size={17} className="text-[var(--muted)]" />
            </button>
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--success-soft)] px-3 py-3 text-xs font-medium leading-5 text-[var(--success)]">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />{profile.googleConnected ? "Google sign-in is connected." : "Email and password sign-in is enabled."}
            </div>
            <button type="button" onClick={() => setConfirmLogout(true)} className="profile-logout mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold">
              <LogOut size={16} /> Log out
            </button>
          </aside>
        </div>
      </section>

      {dialog === "edit" && <Modal title="Edit profile" onClose={closeDialog}><form className="grid gap-5" onSubmit={saveProfile}><div className="flex items-center gap-4"><ProfileAvatar src={preview} initials={initials} /><label className="profile-photo-action inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-bold text-[var(--foreground)]"><Camera size={16} />Change photo<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={selectPhoto} /></label></div><p className="-mt-3 text-xs text-[var(--muted)]">JPEG, PNG, or WebP. Maximum 1 MB.</p><Field label="Name"><input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="profile-input" autoComplete="name" /></Field><Field label="Phone"><input value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} className="profile-input" autoComplete="tel" placeholder="Add your phone number" /></Field>{formError && <FormError message={formError} />}<div className="grid grid-cols-2 gap-3"><Button type="button" variant="secondary" onClick={closeDialog} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save changes"}</Button></div></form></Modal>}
      {dialog === "password" && <Modal title="Change password" onClose={closeDialog}><form className="grid gap-4" onSubmit={savePassword}><p className="text-sm leading-6 text-[var(--muted)]">Use your current password to confirm this change.</p><PasswordField label="Current password" value={passwords.currentPassword} visible={showPasswords.current} onChange={(value) => setPasswords((current) => ({ ...current, currentPassword: value }))} onToggle={() => setShowPasswords((current) => ({ ...current, current: !current.current }))} autoComplete="current-password" /><PasswordField label="New password" value={passwords.newPassword} visible={showPasswords.next} onChange={(value) => setPasswords((current) => ({ ...current, newPassword: value }))} onToggle={() => setShowPasswords((current) => ({ ...current, next: !current.next }))} autoComplete="new-password" /><PasswordField label="Confirm new password" value={passwords.confirmPassword} visible={showPasswords.confirm} onChange={(value) => setPasswords((current) => ({ ...current, confirmPassword: value }))} onToggle={() => setShowPasswords((current) => ({ ...current, confirm: !current.confirm }))} autoComplete="new-password" />{formError && <FormError message={formError} />}<div className="grid grid-cols-2 gap-3"><Button type="button" variant="secondary" onClick={closeDialog} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Updating..." : "Change password"}</Button></div></form></Modal>}
      {confirmLogout && <Modal title="Log out?" onClose={() => setConfirmLogout(false)}><p className="text-sm leading-6 text-[var(--muted)]">You will need to sign in again to manage bookings and trips.</p><div className="mt-6 grid grid-cols-2 gap-3"><Button type="button" variant="secondary" onClick={() => setConfirmLogout(false)}>Cancel</Button><Button type="button" variant="danger" onClick={logout}>Log out</Button></div></Modal>}
    </>
  );
}

function ProfileAvatar({ src, initials, size = "normal" }) {
  const className = size === "large" ? "profile-avatar h-24 w-24 text-2xl sm:h-28 sm:w-28" : "profile-avatar h-16 w-16 text-lg";
  if (src) {
    // User-uploaded data URLs stay local and should not pass through the Next image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="Profile photo" decoding="async" className={`${className} shrink-0 rounded-full object-cover`} />;
  }
  return <span className={`${className} grid shrink-0 place-items-center rounded-full font-extrabold`}>{initials}</span>;
}

function Detail({ icon: Icon, label, value }) {
  return <div className="profile-detail flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--border)] px-3.5 py-3.5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"><Icon size={17} /></span><div className="min-w-0"><p className="text-xs font-medium text-[var(--muted)]">{label}</p><p className="mt-0.5 truncate text-sm font-semibold text-[var(--foreground)]">{value}</p></div></div>;
}

function Field({ label, children }) { return <label className="grid gap-1.5 text-sm font-semibold text-[var(--foreground)]">{label}{children}</label>; }
function PasswordField({ label, value, visible, onChange, onToggle, autoComplete }) { return <Field label={label}><div className="relative"><input type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} className="profile-input pr-11" /><button type="button" onClick={onToggle} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--primary-soft)]" aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></Field>; }
function FormError({ message }) { return <p className="flex items-start gap-2 rounded-xl border border-[#efcaca] bg-[var(--danger-soft)] px-3 py-2.5 text-sm text-[var(--danger)]" role="alert"><AlertCircle size={16} className="mt-0.5 shrink-0" />{message}</p>; }
function Modal({ title, children, onClose }) { return <div className="app-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="profile-modal w-full max-w-md rounded-3xl border border-[var(--glass-border)] bg-white/[.94] p-5 shadow-[var(--shadow-float)] backdrop-blur-2xl sm:p-6" role="dialog" aria-modal="true" aria-label={title}><div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-bold text-[var(--foreground)]">{title}</h2><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--primary-soft)]" aria-label="Close"><X size={18} /></button></div>{children}</section></div>; }function fileToDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("Unable to read this image.")); reader.readAsDataURL(file); }); }
