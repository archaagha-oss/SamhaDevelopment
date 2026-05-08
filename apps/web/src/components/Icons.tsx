import { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (props: IconProps) => ({
  width: props.size ?? 18,
  height: props.size ?? 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
  ...props,
});

export function IconDashboard(p: IconProps = {}) {
  return (
    <svg {...base(p)}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
  );
}
export function IconBuilding(p: IconProps = {}) {
  return (
    <svg {...base(p)}><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M16 9h2a2 2 0 0 1 2 2v10"/><path d="M9 9h2"/><path d="M9 13h2"/><path d="M9 17h2"/></svg>
  );
}
export function IconGrid(p: IconProps = {}) {
  return (
    <svg {...base(p)}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
  );
}
export function IconUsers(p: IconProps = {}) {
  return (
    <svg {...base(p)}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  );
}
export function IconUser(p: IconProps = {}) {
  return (
    <svg {...base(p)}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  );
}
export function IconHandshake(p: IconProps = {}) {
  return (
    <svg {...base(p)}><path d="m11 17 2 2a1 1 0 0 0 1.4 0l3.6-3.6a1 1 0 0 1 1.4 0l1.6 1.6"/><path d="m14 14 2.5 2.5"/><path d="M18 14 8 4"/><path d="m6 14-3.6-3.6a1 1 0 0 1 0-1.4l3.6-3.6a1 1 0 0 1 1.4 0L11 9"/></svg>
  );
}
export function IconCheck(p: IconProps = {}) {
  return (
    <svg {...base(p)}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
  );
}
export function IconBookmark(p: IconProps = {}) {
  return (
    <svg {...base(p)}><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
  );
}
export function IconTag(p: IconProps = {}) {
  return (
    <svg {...base(p)}><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5"/></svg>
  );
}
export function IconFile(p: IconProps = {}) {
  return (
    <svg {...base(p)}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>
  );
}
export function IconBriefcase(p: IconProps = {}) {
  return (
    <svg {...base(p)}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
  );
}
export function IconCard(p: IconProps = {}) {
  return (
    <svg {...base(p)}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
  );
}
export function IconList(p: IconProps = {}) {
  return (
    <svg {...base(p)}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
  );
}
export function IconCoin(p: IconProps = {}) {
  return (
    <svg {...base(p)}><circle cx="12" cy="12" r="9"/><path d="M12 7v10"/><path d="M9 9.5a2.5 2.5 0 0 1 5 0c0 1.4-1.1 2.1-2.5 2.5C10 12.4 9 13.1 9 14.5a2.5 2.5 0 0 0 5 0"/></svg>
  );
}
export function IconChart(p: IconProps = {}) {
  return (
    <svg {...base(p)}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
  );
}
export function IconSettings(p: IconProps = {}) {
  return (
    <svg {...base(p)}><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/><circle cx="12" cy="12" r="3"/></svg>
  );
}
export function IconBell(p: IconProps = {}) {
  return (
    <svg {...base(p)}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
  );
}
export function IconSearch(p: IconProps = {}) {
  return (
    <svg {...base(p)}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
  );
}
export function IconChevronUp(p: IconProps = {}) {
  return <svg {...base(p)}><polyline points="18 15 12 9 6 15"/></svg>;
}
export function IconChevronDown(p: IconProps = {}) {
  return <svg {...base(p)}><polyline points="6 9 12 15 18 9"/></svg>;
}
export function IconChevronLeft(p: IconProps = {}) {
  return <svg {...base(p)}><polyline points="15 18 9 12 15 6"/></svg>;
}
export function IconChevronRight(p: IconProps = {}) {
  return <svg {...base(p)}><polyline points="9 18 15 12 9 6"/></svg>;
}
export function IconChevronsUpDown(p: IconProps = {}) {
  return <svg {...base(p)}><polyline points="7 15 12 20 17 15"/><polyline points="7 9 12 4 17 9"/></svg>;
}
export function IconRefresh(p: IconProps = {}) {
  return (
    <svg {...base(p)}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/></svg>
  );
}
