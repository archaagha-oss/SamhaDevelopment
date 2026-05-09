import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Global keyboard-shortcut layer. Mounted once by <GlobalShortcuts /> in
// AppShell. Linear/Notion-style chord pattern (`g` then `l`) for navigation,
// plus single-key shortcuts (`c` for create on the current list page).
//
// Skips when focus is inside an editable element so typing in a form doesn't
// trigger shortcuts. Cmd/Ctrl-modified keys are also ignored (those are owned
// by the browser or by app-specific handlers like the Cmd+K palette).

const CHORD_TIMEOUT_MS = 1500;

// pathname prefix → /<prefix>/new (best-effort "create on current list page")
const CREATE_BY_LIST: Array<[RegExp, string]> = [
  [/^\/leads(\/|$)/,         "/leads/new"],
  [/^\/deals(\/|$)/,         "/deals/new"],
  [/^\/contacts(\/|$)/,      "/contacts/new"],
  [/^\/team(\/|$)/,          "/team/new"],
  [/^\/payment-plans(\/|$)/, "/payment-plans/new"],
  // Project-scoped unit create requires a projectId — skip from generic.
];

// `g` + key → destination
const GOTO_MAP: Record<string, string> = {
  h: "/",                 // Home / Dashboard
  l: "/leads",
  d: "/deals",
  c: "/contacts",
  u: "/units",
  p: "/projects",
  r: "/reports",
  s: "/settings",
  t: "/team",
  i: "/inbox",            // Hot inbox
  o: "/offers-list",
  v: "/reservations",     // "v" for reserVations (r is taken by reports)
  k: "/contracts",        // "k" for kontracts (c is taken)
  b: "/brokers",
  f: "/finance",
  m: "/commissions",
  a: "/tasks",            // Activities
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  // Use refs so the keydown handler doesn't need to re-bind on every nav.
  const navRef = useRef(navigate);
  const locRef = useRef(location);
  navRef.current = navigate;
  locRef.current = location;

  // chord state — true when the user has pressed `g` recently
  const chordActive = useRef(false);
  const chordTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearChord = () => {
      chordActive.current = false;
      if (chordTimer.current) {
        clearTimeout(chordTimer.current);
        chordTimer.current = null;
      }
    };

    const handler = (e: KeyboardEvent) => {
      if (e.repeat)                          return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target))        return;

      const key = e.key.toLowerCase();

      // Chord follow-up: `g` then x
      if (chordActive.current) {
        const dest = GOTO_MAP[key];
        clearChord();
        if (dest) {
          e.preventDefault();
          navRef.current(dest);
        }
        return;
      }

      // Single-key shortcuts
      switch (key) {
        case "g": {
          // Start chord
          chordActive.current = true;
          chordTimer.current = setTimeout(clearChord, CHORD_TIMEOUT_MS);
          e.preventDefault();
          return;
        }
        case "c": {
          const path = locRef.current.pathname;
          for (const [regex, dest] of CREATE_BY_LIST) {
            if (regex.test(path)) {
              e.preventDefault();
              navRef.current(dest);
              return;
            }
          }
          return;
        }
        case "/": {
          // Focus the first search input on the current page.
          const input = document.querySelector<HTMLInputElement>('input[type="search"]');
          if (input) {
            e.preventDefault();
            input.focus();
            input.select();
          }
          return;
        }
        case "?": {
          // Reserved — could open a help dialog. Currently a no-op so the
          // chord-cancel path doesn't accidentally fire on shifted keys.
          return;
        }
        default:
          return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (chordTimer.current) clearTimeout(chordTimer.current);
    };
  }, []);
}
