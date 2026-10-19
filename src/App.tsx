import { Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { I18nProvider } from "./lib/i18n";
import { ThemeProvider } from "./lib/theme";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Problems from "./pages/Problems";
import Practice from "./pages/Practice";
import TestRunner from "./pages/TestRunner";
import Results from "./pages/Results";
import PastTests from "./pages/PastTests";
import About from "./pages/About";
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
        <ScrollToTop />
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/problems" element={<Problems />} />
              <Route path="/practice" element={<Practice />} />
              <Route path="/test/:id" element={<TestRunner />} />
              <Route path="/test/:id/results" element={<Results />} />
              <Route path="/past-tests" element={<PastTests />} />
              <Route path="/about" element={<About />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </I18nProvider>
    </ThemeProvider>
  );
}
