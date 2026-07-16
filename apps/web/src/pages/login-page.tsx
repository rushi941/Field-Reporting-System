import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  getHomePathForRoles,
  loginSchema,
  type LoginInput,
} from "@frs/shared";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/auth/auth-context";
import { LoginHeroSlider } from "@/components/auth/login-hero-slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (loading) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 auth-grid-noise">
        <Loader2 className="size-8 animate-spin text-asphalt-mid" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to={getHomePathForRoles(user.roles)} replace />;
  }

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    try {
      const signedIn = await login(values.email, values.password);
      toast.success("Signed in successfully");
      const home = getHomePathForRoles(signedIn.roles);
      const from = (location.state as { from?: string } | null)?.from;
      const allowedFrom =
        from && from !== "/login" && !from.startsWith("/login") ? from : null;
      navigate(allowedFrom ?? home, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-grid-noise grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section className="relative flex flex-col px-6 py-8 sm:px-10 lg:px-16 xl:px-24">
        <div className="animate-fade-up mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center">
          <header className="mb-10">
            <div className="flex items-center gap-3.5">
              <div className="flex size-12 shrink-0 items-center justify-center bg-asphalt shadow-[3px_3px_0_0_var(--color-lane)]">
                <span className="font-display text-xl font-bold leading-none text-lane">
                  AT
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-display text-2xl font-semibold tracking-tight text-asphalt-mid sm:text-[1.75rem]">
                  Advance Traffic
                </p>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Field Reporting System
                </p>
              </div>
            </div>

            <div className="mt-10 border-t border-border/80 pt-8">
              <h1 className="font-display text-4xl font-semibold tracking-tight text-asphalt-mid sm:text-[2.75rem]">
                Sign in
              </h1>
            </div>
          </header>

          <form
            className="space-y-6"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                className="h-12 rounded-md border-border bg-card px-3.5 text-[15px] shadow-none transition-shadow focus-visible:border-asphalt-mid focus-visible:ring-asphalt-mid/20"
                disabled={submitting}
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="h-12 rounded-md border-border bg-card px-3.5 pr-12 text-[15px] shadow-none transition-shadow focus-visible:border-asphalt-mid focus-visible:ring-asphalt-mid/20"
                  disabled={submitting}
                  {...form.register("password")}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button
              className="mt-1 h-12 w-full rounded-md bg-asphalt-mid text-[15px] font-semibold tracking-wide text-lane shadow-[0_1px_0_0_rgba(0,0,0,0.2)] transition hover:bg-asphalt hover:text-lane"
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </div>
      </section>

      <aside className="relative hidden min-h-svh lg:block">
        <LoginHeroSlider className="absolute inset-0 min-h-svh" />
      </aside>
    </div>
  );
}
