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

  // Logo click reloads the page
  const handleLogoClick = (e) => {
    e.preventDefault();
    if (window.location.pathname === "/") {
      window.location.reload();
    } else {
      window.location.assign("/");
    }
  };

  return (
    <>
      {/* Dim backdrop behind the open menu */}
      <div
        aria-hidden="true"
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
              Solvex<span className="text-[#3DDC97]">MarketInc</span>
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

            {/* Dropdown panel: full width on mobile, anchored card on desktop */}
            <div
              id="site-menu"
              className={`absolute left-0 right-0 top-full origin-top border-b border-white/10 bg-[#0B141B] shadow-2xl shadow-black/60 transition-all duration-300 ease-out motion-reduce:transition-none sm:left-auto sm:right-0 sm:top-[calc(100%+14px)] sm:w-80 sm:rounded-2xl sm:border ${
                open
                  ? "visible translate-y-0 scale-100 opacity-100"
                  : "invisible -translate-y-3 scale-[0.98] opacity-0"
              }`}
            >
              <ul className="p-2 sm:p-2.5">
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
                      onClick={() => setOpen(false)}
                      tabIndex={open ? 0 : -1}
                      className="group flex items-center gap-3.5 rounded-xl px-3.5 py-3 transition-colors duration-200 hover:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
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
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </header>

      {/* Spacer so page content isn't hidden behind the fixed header */}
      <div className="h-16 sm:h-[72px]" aria-hidden="true" />
    </>
  );
}