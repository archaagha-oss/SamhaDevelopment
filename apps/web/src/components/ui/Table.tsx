import { ReactNode, ThHTMLAttributes, TdHTMLAttributes, HTMLAttributes } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

/**
 * Light table primitives. Each list page keeps its own cell rendering
 * (status pills, action clusters, inline edits, etc.) — these primitives
 * just standardise the CHROME so every table looks like part of the same app:
 * border, header background, row hover, divider, sticky header, sort icons.
 *
 * Use it like a normal <table>:
 *
 *   <TableShell>
 *     <thead>
 *       <tr>
 *         <Th sortable sortDir={sort === "name" ? dir : null} onSort={() => toggleSort("name")}>Name</Th>
 *         <Th align="right">Price</Th>
 *       </tr>
 *     </thead>
 *     <tbody>
 *       {rows.map(r => (
 *         <TableRow key={r.id} onClick={() => nav(`/x/${r.id}`)}>
 *           <TableCell>{r.name}</TableCell>
 *           <TableCell align="right">{fmt(r.price)}</TableCell>
 *         </TableRow>
 *       ))}
 *     </tbody>
 *   </TableShell>
 */

interface ShellProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Wraps the <table> in a sticky header + scroll area when set. */
  stickyHeader?: boolean;
  /** Adds the standard rounded card border. Disable for full-bleed pages. */
  bordered?: boolean;
}

export function TableShell({ children, stickyHeader = true, bordered = true, className = "", ...rest }: ShellProps) {
  return (
    <div
      {...rest}
      className={[
        "bg-white overflow-auto",
        bordered ? "rounded-card border border-slate-200 shadow-card" : "",
        className,
      ].join(" ")}
    >
      <table className={[
        "w-full text-sm",
        stickyHeader ? "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:bg-slate-50 [&_thead_th]:z-10" : "",
      ].join(" ")}>
        {children}
      </table>
    </div>
  );
}

type Align = "left" | "right" | "center";

interface ThProps extends Omit<ThHTMLAttributes<HTMLTableCellElement>, "onClick"> {
  align?: Align;
  sortable?: boolean;
  sortDir?: "asc" | "desc" | null;
  onSort?: () => void;
  children: ReactNode;
}

export function Th({ align = "left", sortable, sortDir, onSort, children, className = "", ...rest }: ThProps) {
  const alignCls = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const inner = (
    <span
      className={[
        "inline-flex items-center gap-1",
        align === "right" ? "flex-row-reverse" : "",
      ].join(" ")}
    >
      {children}
      {sortable && (
        sortDir === "asc"  ? <ArrowUp       className="h-3 w-3 text-slate-700" /> :
        sortDir === "desc" ? <ArrowDown     className="h-3 w-3 text-slate-700" /> :
                             <ArrowUpDown   className="h-3 w-3 text-slate-300" />
      )}
    </span>
  );
  return (
    <th
      {...rest}
      scope="col"
      aria-sort={
        sortDir === "asc"  ? "ascending"  :
        sortDir === "desc" ? "descending" :
        sortable           ? "none"       :
        undefined
      }
      className={[
        "px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200",
        alignCls,
        sortable ? "cursor-pointer select-none hover:text-slate-800 transition-colors" : "",
        className,
      ].join(" ")}
      onClick={sortable ? onSort : undefined}
    >
      {inner}
    </th>
  );
}

interface RowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Renders a hover/click affordance + cursor pointer when set. */
  onClick?: () => void;
  /** Renders a subtle highlight (e.g. for overdue / urgent rows). */
  emphasis?: "none" | "danger" | "warning" | "success";
  selected?: boolean;
}

const EMPHASIS: Record<NonNullable<RowProps["emphasis"]>, string> = {
  none:    "",
  danger:  "bg-red-50/40",
  warning: "bg-amber-50/40",
  success: "bg-emerald-50/40",
};

export function TableRow({ onClick, emphasis = "none", selected, className = "", children, ...rest }: RowProps) {
  return (
    <tr
      {...rest}
      onClick={onClick}
      className={[
        "border-b border-slate-100 last:border-b-0 transition-colors",
        EMPHASIS[emphasis],
        selected ? "bg-blue-50/60" : "",
        onClick ? "cursor-pointer hover:bg-slate-50" : "",
        className,
      ].join(" ")}
    >
      {children}
    </tr>
  );
}

interface CellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: Align;
  numeric?: boolean;
  truncate?: boolean;
  /** Compact / Comfortable density. Defaults to comfortable. */
  density?: "comfortable" | "compact";
}

export function TableCell({
  align,
  numeric,
  truncate,
  density = "comfortable",
  className = "",
  children,
  ...rest
}: CellProps) {
  const a = align ?? (numeric ? "right" : "left");
  const alignCls = a === "right" ? "text-right tabular-nums" : a === "center" ? "text-center" : "text-left";
  const padCls   = density === "compact" ? "px-4 py-2" : "px-4 py-3";
  return (
    <td
      {...rest}
      className={[
        padCls,
        alignCls,
        "text-slate-700",
        truncate ? "truncate max-w-0" : "",
        className,
      ].join(" ")}
    >
      {children}
    </td>
  );
}
