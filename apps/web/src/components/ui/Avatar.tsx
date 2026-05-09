interface Props {
  name?: string;
  imageUrl?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Adds a coloured ring (e.g. for online status / current user). */
  ring?: "none" | "blue" | "emerald" | "amber" | "red";
  className?: string;
}

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
};

const RING: Record<NonNullable<Props["ring"]>, string> = {
  none:    "",
  blue:    "ring-2 ring-blue-400 ring-offset-2",
  emerald: "ring-2 ring-emerald-400 ring-offset-2",
  amber:   "ring-2 ring-amber-400 ring-offset-2",
  red:     "ring-2 ring-red-400 ring-offset-2",
};

/**
 * Deterministic colour pulled from the name so the same user always gets
 * the same swatch — handy for spotting people in lists.
 */
function colorFor(name = ""): string {
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-violet-100 text-violet-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-cyan-100 text-cyan-700",
    "bg-indigo-100 text-indigo-700",
    "bg-teal-100 text-teal-700",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

function initials(name = ""): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
}

export function Avatar({ name = "", imageUrl, size = "md", ring = "none", className = "" }: Props) {
  const sizeCls = SIZE[size];
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`${sizeCls} rounded-full object-cover flex-shrink-0 ${RING[ring]} ${className}`}
      />
    );
  }
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold flex-shrink-0 select-none ${sizeCls} ${colorFor(name)} ${RING[ring]} ${className}`}
      aria-label={name || "Avatar"}
      title={name || undefined}
    >
      {initials(name)}
    </span>
  );
}
