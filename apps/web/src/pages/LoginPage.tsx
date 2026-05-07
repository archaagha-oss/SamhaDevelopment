import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { login, status, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated" && user) {
    const next =
      (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/";
    return <Navigate to={user.mustChangePassword ? "/change-password" : next} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const u = await login(email.trim().toLowerCase(), password);
      toast.success(`Welcome, ${u.name}`);
      const next =
        (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/";
      navigate(u.mustChangePassword ? "/change-password" : next, { replace: true });
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.response?.data?.error || "Login failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-gray-200"
      >
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Samha CRM</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to continue</p>
        </div>

        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          placeholder="you@samha.ae"
        />

        <label className="block text-sm font-medium text-gray-700">Password</label>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 mb-6 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          placeholder="••••••••"
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <p className="mt-4 text-center text-xs text-gray-500">
          Need an account? Contact your administrator.
        </p>
      </form>
    </div>
  );
}
