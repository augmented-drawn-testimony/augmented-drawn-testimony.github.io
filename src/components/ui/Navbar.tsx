import { QuestionMarkCircleIcon } from "@heroicons/react/24/solid";
import Image from "next/image";
import Link from "next/link";
import { JSX } from "react";
import type { Language } from "../../../store/appSlice";
import { messages } from "../../i18n/messages";

interface NavbarProps {
  language: Language;
  tutorialOpen: boolean;
  arMode: boolean;
  onToggleAr: () => void;
  onLanguageChange: (language: Language) => void;
  onLogoClick: () => void;
  onOpenTutorial: () => void;
}

export function Navbar({
  language,
  tutorialOpen,
  arMode,
  onToggleAr,
  onLanguageChange,
  onLogoClick,
  onOpenTutorial,
}: NavbarProps): JSX.Element {
  const ui = messages[language].navbar;

  return (
    <nav
      aria-label={ui.primaryNavigation}
      className="relative z-[950] flex h-14 w-full shrink-0 items-stretch bg-white/95 px-2"
    >
      <Link
        aria-label={ui.returnToBeginning}
        className="navbar-logo relative mr-2 w-18 shrink-0 sm:w-24"
        href="/"
        onClick={onLogoClick}
      >
        <Image
          src="/assets/cropped-logoOctober-1.png"
          fill
          className="ml-4 scale-150"
          style={{ objectFit: "contain" }}
          sizes="(min-width: 640px) 96px, 88px"
          alt={ui.logoAlt}
          priority
        />
      </Link>
      <div
        aria-label={ui.language}
        className="navbar-language ml-auto my-2"
        role="group"
      >
        {(["en", "da"] as const).map((locale) => (
          <button
            key={locale}
            type="button"
            aria-pressed={language === locale}
            onClick={(event) => {
              event.stopPropagation();
              onLanguageChange(locale);
            }}
          >
            <span className="sm:hidden">{locale.toUpperCase()}</span>
            <span className="hidden sm:inline">
              {locale === "en" ? "English" : "Dansk"}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="interface-pill-button navbar-view-button ml-2 my-2"
        aria-pressed={arMode}
        onClick={(event) => {
          event.stopPropagation();
          onToggleAr();
        }}
      >
        {arMode ? ui.story : ui.ar}
      </button>

      <button
        type="button"
        className="interface-pill-button navbar-tutorial-button ml-2 my-2"
        aria-label={ui.openTutorial}
        aria-expanded={tutorialOpen}
        onClick={(event) => {
          event.stopPropagation();
          onOpenTutorial();
        }}
      >
        <span className="hidden md:inline">{ui.tutorial}</span>
        <QuestionMarkCircleIcon className="size-5 fill-current" />
      </button>
    </nav>
  );
}
