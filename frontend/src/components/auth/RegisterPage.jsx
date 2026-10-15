"use client";

import Link from "../common/SmartLink";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { BrandMark } from "../common/BrandMark";
import { useAuth } from "../../hooks/useAuth";
import { getProfile, getRoleHome, register as registerUser } from "../../services/authService";

const registrationSchema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  confirmPassword: z.string().min(1, "Confirm your password."),
}).refine((values) => values.password === values.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match.",
});

function safeRedirect(value) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(registrationSchema) });
  const redirectTo = safeRedirect(searchParams.get("redirect"));

  useEffect(() => {
    if (!authLoading && isAuthenticated) router.replace(redirectTo);
  }, [authLoading, isAuthenticated, redirectTo, router]);

  async function handleRegistration(values) {
    setSubmitting(true);
    setServerError("");
    try {
      await registerUser({ name: values.name, email: values.email, password: values.password });
      const user = await getProfile();
      router.replace(getRoleHome(user.role, redirectTo));
    } catch (error) {
      const message = error.response?.data?.message;
      setServerError(message === "User already exists" ? "An account with this email already exists." : "Unable to create your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="flex min-h-screen flex-col bg-[var(--background)]"><div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-8"><div className="w-full max-w-md"><Link href="/" className="mx-auto flex w-fit items-center gap-2.5"><BrandMark size={40} priority /><span className="leading-none"><span className="block text-sm font-bold text-[var(--foreground)]">Smart Safar</span><span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--primary-ink)]">Faisalabad</span></span></Link><Card className="mt-6 p-6 sm:p-8"><div className="text-center"><h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Create Your Account</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Create an account to manage your Smart Safar trips.</p></div>{serverError && <div className="mt-6 rounded-xl border border-[#f4cccc] bg-[#fff8f8] px-4 py-3 text-sm text-[var(--danger)]" role="alert">{serverError}</div>}<form className="mt-6 grid gap-5" onSubmit={handleSubmit(handleRegistration)} noValidate><FormField id="name" label="Full name" error={errors.name?.message}><div className="relative"><UserRound size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><input id="name" type="text" autoComplete="name" placeholder="Your name" className="field-input field-input--leading-icon" {...register("name")} /></div></FormField><FormField id="email" label="Email address" error={errors.email?.message}><div className="relative"><Mail size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><input id="email" type="email" autoComplete="email" placeholder="you@example.com" className="field-input field-input--leading-icon" {...register("email")} /></div></FormField><FormField id="password" label="Password" error={errors.password?.message}><PasswordInput id="password" visible={showPassword} onToggle={() => setShowPassword((visible) => !visible)} placeholder="At least 6 characters" autoComplete="new-password" registration={register("password")} /></FormField><FormField id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}><PasswordInput id="confirmPassword" visible={showConfirmation} onToggle={() => setShowConfirmation((visible) => !visible)} placeholder="Repeat your password" autoComplete="new-password" registration={register("confirmPassword")} /></FormField><Button type="submit" className="mt-1 min-h-12 w-full" disabled={submitting}>{submitting ? "Creating Account..." : "Create Account"}</Button></form></Card><p className="mt-6 text-center text-sm text-[var(--muted)]">Already have an account? <Link href={`/login${searchParams.get("redirect") ? `?redirect=${encodeURIComponent(searchParams.get("redirect"))}` : ""}`} className="font-semibold text-[var(--primary-ink)] hover:text-[var(--primary-ink)]">Sign in</Link></p><Link href="/live-map" className="mt-3 block text-center text-sm font-semibold text-[var(--primary-ink)] hover:text-[var(--primary-ink)]">Continue browsing</Link></div></div></main>;
}

function FormField({ id, label, error, children }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-[var(--foreground)]" htmlFor={id}>{label}{children}{error && <span className="text-xs font-normal text-[var(--danger)]">{error}</span>}</label>;
}

function PasswordInput({ id, visible, onToggle, placeholder, autoComplete, registration }) {
  return <div className="relative"><LockKeyhole size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><input id={id} type={visible ? "text" : "password"} autoComplete={autoComplete} placeholder={placeholder} className="field-input field-input--leading-icon field-input--trailing-control" {...registration} /><button type="button" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary-ink)]" onClick={onToggle} aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>;
}
