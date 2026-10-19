import { Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { I18nProvider } from "./lib/i18n";
import { ThemeProvider } from "./lib/theme";
import { AuthProvider } from "./lib/auth";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import RequireAuth from "./components/RequireAuth";
import Home from "./pages/Home";
import Problems from "./pages/Problems";
import Practice from "./pages/Practice";
import Tests from "./pages/Tests";
import Login from "./pages/Login";
import Leaderboard from "./pages/Leaderboard";
import Admin from "./pages/Admin";
import TestRunner from "./pages/TestRunner";
import Results from "./pages/Results";
import PastTests from "./pages/PastTests";
import NotFound from "./pages/NotFound";

/** Reset scroll position on every route change (SPA behaviour users expect). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <ThemeProvider>
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
                {/* Competitive routes require a signed-in learner. */}
                <Route
                  path="/tests"
                  element={
                    <RequireAuth>
                      <Tests />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/leaderboard"
                  element={
                    <RequireAuth>
                      <Leaderboard />
                    </RequireAuth>
                  }
                />
                {/* The runner stays open so anonymous practice still works; the
                    scheduled papers enforce sign-in at their start flow. */}
                <Route path="/test/:id" element={<TestRunner />} />
                <Route path="/test/:id/results" element={<Results />} />
                <Route
                  path="/past-tests"
                  element={
                    <RequireAuth>
                      <PastTests />
                    </RequireAuth>
                  }
                />
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
