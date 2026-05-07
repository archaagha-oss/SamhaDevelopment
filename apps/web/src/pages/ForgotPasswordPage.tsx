import { FormEvent, useState } from "react";
import axios from "axios";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post("/api/auth/forgot-password", { email: email.trim().toLowerCase() });
    } finally {
      setSubmitting(false);
      setDone(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-semibold text-gray-900">Reset your password</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          Enter your email and we'll send you a reset link.
        </p>

        {done ? (
          <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md p-4">
            If an account exists for that email, a reset link has been sent. Check your inbox.
            <div className="mt-4">
              <a href="/login" className="text-blue-600 hover:underline">
                Back to sign in
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 rounded-md text-sm"
            >
              {submitting ? "Sending…" : "Send reset link"}
            </button>
            <div className="text-center">
              <a href="/login" className="text-sm text-gray-600 hover:underline">
                Back to sign in
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
