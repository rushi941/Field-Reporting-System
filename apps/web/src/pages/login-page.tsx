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
    <div className="auth-grid-noise grid min-h-svh lg:grid-cols-2">
      <section className="relative flex flex-col justify-center px-5 py-8 sm:px-10 lg:px-14 xl:px-20">
        <div className="animate-fade-up mx-auto w-full max-w-md">
          <div className="mb-8 lg:mb-10">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center bg-asphalt shadow-[3px_3px_0_0_var(--color-lane)]">
                <span className="font-display text-lg font-bold text-lane">AT</span>
              </div>
              <div>
                <p className="font-display text-xl font-semibold tracking-wide text-asphalt-mid sm:text-2xl">
                  Advance Traffic
                </p>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Field Reporting System
                </p>
              </div>
            </div>

            <h1 className="font-display text-3xl font-semibold text-asphalt-mid sm:text-4xl">
              Sign in
            </h1>
          </div>

          <form
            className="space-y-5 rounded-md border border-border bg-card/90 p-5 shadow-sm backdrop-blur-sm sm:p-6"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                className="h-11 bg-background"
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
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="h-11 bg-background pr-11"
                  disabled={submitting}
                  {...form.register("password")}
                />
                <button
                  type="button"
                  className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
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
              className="h-11 w-full bg-asphalt-mid font-semibold text-lane hover:bg-asphalt hover:text-lane"
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
