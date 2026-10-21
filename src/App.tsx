import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { I18nProvider } from "./lib/i18n";
import { AuthProvider } from "./lib/auth";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Problems from "./pages/Problems";
import Practice from "./pages/Practice";
import Contests from "./pages/Contests";
import Login from "./pages/Login";
import Leaderboard from "./pages/Leaderboard";
import Admin from "./pages/Admin";
import TestRunner from "./pages/TestRunner";
import Results from "./pages/Results";
import NotFound from "./pages/NotFound";

/**
 * Reset scroll position on every route change (SPA behaviour users expect),
 * and honour a section link such as `/practice#past-tests`.
 */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      const land = () => {
        const target = document.getElementById(id);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      land();
      // The target may still be mounting on a cold route change.
      const raf = requestAnimationFrame(land);
      return () => cancelAnimationFrame(raf);
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <ScrollToTop />
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/problems" element={<Problems />} />
              <Route path="/practice" element={<Practice />} />
              <Route path="/login" element={<Login />} />
              {/* The contest tab and the problems-solved leaderboard are open
                  to everyone — reading the boards needs no account. Only
                  sitting a contest does (see the contest page). */}
              <Route path="/contests" element={<Contests />} />
              {/* The old scheduled-test address now points at the contest tab. */}
              <Route path="/tests" element={<Navigate to="/contests" replace />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              {/* The runner stays open so anonymous practice still works; the
                  scheduled papers enforce sign-in at their start flow. */}
              <Route path="/test/:id" element={<TestRunner />} />
              <Route path="/test/:id/results" element={<Results />} />
              {/* Past tests live on the practice builder now — no own tab. */}
              <Route path="/past-tests" element={<Navigate to="/practice" replace />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </I18nProvider>
  );
}
