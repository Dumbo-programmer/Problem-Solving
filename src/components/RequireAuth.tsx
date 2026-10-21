import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../lib/auth";

/**
 * Route guard for the competitive parts of the app.
 *
 * Weekly/monthly tests, their standings and the past-test archive need an
 * account, so anonymous visitors are sent to `/login` carrying a `next=` back
 * to where they were headed. Home, the problem archive, the practice builder
 * and the leaderboard (read-only for visitors) stay open to everyone.
 *
 * While the session is still being validated on first load we show a small
 * placeholder instead of bouncing a signed-in learner to the login page.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="shell flex min-h-[40vh] items-center justify-center py-20">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-accent-500 dark:border-ink-700 dark:border-t-accent-400" />
      </div>
    );
  }

  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <>{children}</>;
}
