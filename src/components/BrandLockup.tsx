import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";

/**
 * The co-branded header mark.
 *
 * Prothom Alo sits on top (with its brand-red hairline), the Gonit Ishkul
 * landscape lockup sits below it. Both logos already spell their names, so no
 * wordmark text is rendered — the artwork carries the branding and is sized
 * generously so it stays legible at the navbar's height.
 *
 * The Gonit mark is a trimmed landscape crop (`logo-landscape.png`) of the
 * original square file, so it fills the width instead of sitting in a small
 * square with wide empty margins.
 */

interface BrandLockupProps {
  /** `sm` for the navbar, `lg` for the footer / hero lockups. */
  size?: "sm" | "lg";
  /** Wrap in a router link back home (navbar) or not (footer). */
  linked?: boolean;
  className?: string;
}

export default function BrandLockup({ size = "sm", linked = true, className = "" }: BrandLockupProps) {
  const { t } = useI18n();

  const dims =
    size === "lg"
      ? { palo: "h-7 sm:h-8", gonit: "h-16 sm:h-20", gap: "gap-1.5" }
      : { palo: "h-4 sm:h-[18px]", gonit: "h-11 sm:h-12 lg:h-[54px]", gap: "gap-0.5 sm:gap-1" };

  const inner = (
    <span className={`brand-lockup ${className}`}>
      {/* Prothom Alo — the publisher mark, on top. The wordmark is near-black
          in the source SVG, so dark mode swaps in a light-ink variant to keep
          the brand legible on the retrowave backdrop. */}
      <span className={`inline-flex items-center ${dims.gap}`}>
        <img
          src="/prothom-alo.svg"
          alt="প্রথম আলো · Prothom Alo"
          className={`${dims.palo} w-auto dark:hidden`}
          loading="eager"
          decoding="async"
        />
        <img
          src="/prothom-alo-dark.svg"
          alt=""
          aria-hidden
          className={`${dims.palo} hidden w-auto dark:block`}
          loading="eager"
          decoding="async"
        />
      </span>
      <span className="brand-lockup-divider" aria-hidden />
      {/* Gonit Ishkul — the landscape lockup; the name is baked into the art. */}
      <img
        src="/logo-landscape.png"
        alt={t("brand.name")}
        className={`${dims.gonit} w-auto object-contain drop-shadow-[0_2px_10px_rgba(124,58,237,0.35)]`}
        loading="eager"
        decoding="async"
      />
    </span>
  );

  if (!linked) return inner;

  return (
    <Link to="/" className="group inline-flex" aria-label={t("brand.name")}>
      {inner}
    </Link>
  );
}
