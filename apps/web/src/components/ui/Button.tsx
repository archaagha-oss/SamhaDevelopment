import { forwardRef, ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "danger" | "success" | "ghost" | "subtle";
type Size = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary:   "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500",
  secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:ring-slate-400",
  danger:    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
  success:   "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500",
  ghost:     "bg-transparent text-slate-700 border border-slate-200 hover:bg-slate-50 focus-visible:ring-slate-400",
  subtle:    "bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400",
};

const SIZE: Record<Size, string> = {
  xs: "px-2.5 py-1   text-xs",
  sm: "px-3   py-1.5 text-sm",
  md: "px-4   py-2   text-sm",
  lg: "px-6   py-2.5 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    leadingIcon,
    trailingIcon,
    fullWidth = false,
    disabled,
    className = "",
    children,
    type = "button",
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={[
        "inline-flex items-center justify-center gap-1.5 font-medium rounded-ctrl transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        VARIANT[variant],
        SIZE[size],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {loading ? <Spinner size={size === "xs" ? "xs" : "sm"} /> : leadingIcon}
      {children && <span className="truncate">{children}</span>}
      {trailingIcon && !loading && trailingIcon}
    </button>
  );
});

interface IconButtonProps extends Omit<ButtonProps, "leadingIcon" | "trailingIcon" | "children"> {
  icon: ReactNode;
  label: string; // Required for a11y
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = "subtle", size = "sm", className = "", ...rest },
  ref
) {
  const dim = size === "xs" ? "h-6 w-6" : size === "sm" ? "h-8 w-8" : size === "md" ? "h-9 w-9" : "h-10 w-10";
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={[
        "inline-flex items-center justify-center rounded-ctrl transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        VARIANT[variant],
        dim,
        className,
      ].join(" ")}
      {...rest}
    >
      {icon}
    </button>
  );
});
