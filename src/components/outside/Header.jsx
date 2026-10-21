import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const MENU_ITEMS = [
  {
    label: "About us",
    to: "/about-us",
    hint: "Who we are and how we work",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 8h.01" />
      </svg>
    ),
  },
  {
    label: "Certificates",
    to: "/certificates",
    hint: "Our licences and registrations",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
];

// Each icon opens the homepage of that social network
const SOCIALS = [
  {
    name: "Facebook",
    href: "https://www.facebook.com",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    ),
  },
  {
    name: "X",
    href: "https://x.com",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <path d="M17.5 6.5h.01" />
      </svg>
    ),
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect x="2" y="9" width="4" height="12" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    ),
  },
  {
    name: "Telegram",
    href: "https://telegram.org",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 2L11 13" />
        <path d="M22 2l-7 20-4-9-9-4 20-7z" />
      </svg>
    ),
  },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef(null);

  // One-time slide-in when the header first loads
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Close on outside click and Escape
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // On mobile, lock page scroll while the sidebar is open
  useEffect(() => {
    if (!open) return;
    if (!window.matchMedia("(max-width: 639px)").matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Logo click reloads the page
  const handleLogoClick = (e) => {
    e.preventDefault();
    if (window.location.pathname === "/") {
      window.location.reload();
    } else {
      window.location.assign("/");
    }
  };

  const close = () => setOpen(false);
  const stagger = (ms) => ({ transitionDelay: open ? `${ms}ms` : "0ms" });
  const year = new Date().getFullYear();

  return (
    <>
      {/* Keyframes for the mobile sidebar (all switched off for reduced motion) */}
      <style>{`
        @keyframes hdr-shimmer {
          0% { transform: translateX(-140%) skewX(-20deg); }
          60%, 100% { transform: translateX(480%) skewX(-20deg); }
        }
        @keyframes hdr-float {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(0, -16px, 0) scale(1.1); }
        }
        @keyframes hdr-pulse {
          0% { box-shadow: 0 0 0 0 rgba(61, 220, 151, 0.45); }
          70%, 100% { box-shadow: 0 0 0 12px rgba(61, 220, 151, 0); }
        }
        .hdr-shimmer { animation: hdr-shimmer 2.8s ease-in-out infinite; }
        .hdr-float { animation: hdr-float 7s ease-in-out infinite; }
        .hdr-float-slow { animation: hdr-float 9s ease-in-out infinite reverse; }
        .hdr-pulse { animation: hdr-pulse 2.4s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .hdr-shimmer, .hdr-float, .hdr-float-slow, .hdr-pulse { animation: none !important; }
        }
      `}</style>

      {/* Dim backdrop behind the open menu. Clicking it closes the menu */}
      <div
        aria-hidden="true"
        onClick={close}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 motion-reduce:transition-none ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <header
        className={`fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-[#080D12]/90 backdrop-blur-md transition-all duration-700 ease-out motion-reduce:transition-none ${
          mounted ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        }`}
      >
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:h-[72px] sm:px-6 lg:px-8">
          {/* Left: logo + name */}
          <a
            href="/"
            onClick={handleLogoClick}
            aria-label="Solvexmarketinc, reload home page"
            className="group flex w-fit items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0F1B24] ring-1 ring-white/10 transition-colors duration-200 group-hover:ring-[#3DDC97]/50 sm:h-11 sm:w-11">
              <img
                src="/Logo_nbg.png"
                alt=""
                className="h-7 w-7 object-contain sm:h-8 sm:w-8"
                draggable="false"
              />
            </span>
            <span className="hidden text-[1.15rem] font-semibold tracking-tight text-white md:block">
              SOLVE<span className="text-[#FF4D4F]">X</span><span className="text-[#3DDC97]">MARKETINC</span>
            </span>
          </a>

          {/* Center: auth buttons */}
          <nav aria-label="Account" className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/login"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-white/15 px-4 text-sm font-medium text-slate-200 transition-colors duration-200 hover:border-[#3DDC97]/60 hover:bg-[#3DDC97]/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 sm:h-10 sm:px-6"
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[#3DDC97] px-4 text-sm font-semibold text-[#06140E] shadow-[0_6px_18px_-8px_rgba(61,220,151,0.7)] transition-colors duration-200 hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080D12] sm:h-10 sm:px-6"
            >
              Sign up
            </Link>
          </nav>

          {/* Right: hamburger + dropdown */}
          <div ref={menuRef} className="flex justify-end sm:relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="site-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              className={`relative flex h-10 w-10 items-center justify-center rounded-lg border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 ${
                open
                  ? "border-[#3DDC97]/50 bg-[#3DDC97]/10"
                  : "border-white/15 hover:border-white/30 hover:bg-white/5"
              }`}
            >
              <span className="relative block h-4 w-5">
                <span
                  className={`absolute left-0 h-0.5 w-5 rounded-full bg-white transition-all duration-300 ease-out motion-reduce:transition-none ${
                    open ? "top-[7px] rotate-45" : "top-0"
                  }`}
                />
                <span
                  className={`absolute left-0 top-[7px] h-0.5 rounded-full bg-white transition-all duration-300 ease-out motion-reduce:transition-none ${
                    open ? "w-0 opacity-0" : "w-5 opacity-100"
                  }`}
                />
                <span
                  className={`absolute left-0 h-0.5 w-5 rounded-full bg-white transition-all duration-300 ease-out motion-reduce:transition-none ${
                    open ? "top-[7px] -rotate-45" : "top-[14px]"
                  }`}
                />
              </span>
            </button>

            {/* Panel: full-screen sidebar on mobile (no scrolling), anchored card on desktop.
                Clicking anywhere on it closes it. */}
            <div
              id="site-menu"
              onClick={close}
              className={`absolute left-0 right-0 top-full flex h-[calc(100svh-65px)] origin-top flex-col overflow-hidden border-b border-white/10 bg-[#0B141B] shadow-2xl shadow-black/60 transition-all duration-300 ease-out motion-reduce:transition-none sm:left-auto sm:right-0 sm:top-[calc(100%+14px)] sm:h-auto sm:w-80 sm:rounded-2xl sm:border ${
                open
                  ? "visible translate-y-0 scale-100 opacity-100"
                  : "invisible -translate-y-3 scale-[0.98] opacity-0"
              }`}
            >
              {/* Soft floating glows (mobile only) */}
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute -right-20 -top-16 h-64 w-64 rounded-full bg-[#3DDC97]/15 blur-3xl sm:hidden ${
                  open ? "hdr-float" : ""
                }`}
              />
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-[#2E9BFF]/10 blur-3xl sm:hidden ${
                  open ? "hdr-float-slow" : ""
                }`}
              />

              {/* Top: page links */}
              <ul className="relative z-10 space-y-2 p-3 sm:space-y-0 sm:p-2.5">
                {MENU_ITEMS.map((item, i) => (
                  <li
                    key={item.to}
                    style={{ transitionDelay: open ? `${80 + i * 70}ms` : "0ms" }}
                    className={`transition-all duration-300 ease-out motion-reduce:transition-none ${
                      open ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
                    }`}
                  >
                    <Link
                      to={item.to}
                      onClick={close}
                      tabIndex={open ? 0 : -1}
                      className="group flex items-center gap-3.5 rounded-xl bg-white/[0.03] px-3.5 py-3 ring-1 ring-white/[0.06] transition-colors duration-200 hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 sm:bg-transparent sm:ring-0 sm:hover:bg-white/[0.05]"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#12232C] text-[#3DDC97] ring-1 ring-white/10 transition-colors duration-200 group-hover:bg-[#3DDC97]/15 group-hover:ring-[#3DDC97]/40">
                        {item.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[0.95rem] font-medium text-white">
                          {item.label}
                        </span>
                        <span className="block truncate text-[0.8rem] text-slate-400">
                          {item.hint}
                        </span>
                      </span>
                      <svg
                        viewBox="0 0 24 24"
                        className="ml-auto h-4 w-4 shrink-0 text-slate-500 transition-all duration-200 group-hover:translate-x-1 group-hover:text-[#3DDC97] sm:hidden"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Middle: authentication buttons (mobile only) */}
              <div className="relative z-10 flex flex-1 flex-col justify-center gap-3 px-5 sm:hidden">
                {/* Animated divider */}
                <div className="flex items-center gap-3 [@media(max-height:560px)]:hidden" aria-hidden="true">
                  <span
                    style={stagger(220)}
                    className={`h-px flex-1 origin-right bg-gradient-to-r from-transparent to-white/25 transition-transform duration-700 ease-out ${
                      open ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                  <span
                    style={stagger(380)}
                    className={`h-1.5 w-1.5 rounded-full bg-[#3DDC97] transition-all duration-500 ${
                      open ? "scale-100 opacity-100" : "scale-0 opacity-0"
                    }`}
                  />
                  <span
                    style={stagger(220)}
                    className={`h-px flex-1 origin-left bg-gradient-to-l from-transparent to-white/25 transition-transform duration-700 ease-out ${
                      open ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </div>

                {/* Login: glass outline, slides in from the left */}
                <div
                  style={stagger(280)}
                  className={`transition-all duration-500 ease-out motion-reduce:transition-none ${
                    open ? "translate-x-0 opacity-100" : "-translate-x-10 opacity-0"
                  }`}
                >
                  <Link
                    to="/login"
                    onClick={close}
                    tabIndex={open ? 0 : -1}
                    className="group flex h-12 items-center justify-center gap-2.5 rounded-xl border border-white/20 bg-white/[0.04] text-[0.95rem] font-medium text-white backdrop-blur-sm transition-all duration-200 hover:border-[#3DDC97]/60 hover:bg-[#3DDC97]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 active:scale-[0.97]"
                  >
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-[#3DDC97]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
                    </svg>
                    Login
                    <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </Link>
                </div>

                {/* Sign up: solid green with glow, pulse and shimmer, slides in from the right */}
                <div
                  style={stagger(360)}
                  className={`transition-all duration-500 ease-out motion-reduce:transition-none ${
                    open ? "translate-x-0 opacity-100" : "translate-x-10 opacity-0"
                  }`}
                >
                  <div className={`rounded-xl ${open ? "hdr-pulse" : ""}`}>
                    <Link
                      to="/signup"
                      onClick={close}
                      tabIndex={open ? 0 : -1}
                      className="group relative flex h-12 items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-[#3DDC97] via-[#5BEBAD] to-[#3DDC97] text-[0.95rem] font-semibold text-[#06140E] shadow-[0_10px_28px_-10px_rgba(61,220,151,0.8)] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-[0.97]"
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-white/50 blur-[3px] ${
                          open ? "hdr-shimmer" : ""
                        }`}
                      />
                      <svg viewBox="0 0 24 24" className="relative h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="9" cy="8" r="4" />
                        <path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" />
                        <path d="M19 8v6M16 11h6" />
                      </svg>
                      <span className="relative">Sign up</span>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Bottom: social icons + copyright (mobile only) */}
              <div className="relative z-10 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:hidden">
                <ul className="flex items-center justify-center gap-3">
                  {SOCIALS.map((s, i) => (
                    <li
                      key={s.name}
                      style={stagger(440 + i * 60)}
                      className={`transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none ${
                        open ? "rotate-0 scale-100 opacity-100" : "-rotate-12 scale-50 opacity-0"
                      }`}
                    >
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${s.name} (opens in a new tab)`}
                        tabIndex={open ? 0 : -1}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#3DDC97]/50 hover:bg-[#3DDC97]/10 hover:text-[#3DDC97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 active:scale-90"
                      >
                        {s.icon}
                      </a>
                    </li>
                  ))}
                </ul>

                <p
                  style={stagger(760)}
                  className={`mt-4 border-t border-white/10 pt-3 text-center text-[0.7rem] text-slate-500 transition-all duration-700 ease-out motion-reduce:transition-none ${
                    open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                  }`}
                >
                  &copy; {year} Solvexmarketinc. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Spacer so page content isn't hidden behind the fixed header */}
      <div className="h-16 sm:h-[72px]" aria-hidden="true" />
    </>
  );
}