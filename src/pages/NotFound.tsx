import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { useI18n } from "../lib/i18n";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="shell flex flex-col items-center gap-4 py-28 text-center">
      <Compass size={34} className="text-accent-500" />
      <h1 className="font-mono text-5xl font-extrabold text-ink-900 dark:text-white">404</h1>
      <p className="max-w-sm text-slate-600 dark:text-slate-400">{t("notFound.body")}</p>
      <Link to="/" className="btn-primary mt-2">
        {t("notFound.action")}
      </Link>
    </div>
  );
}
