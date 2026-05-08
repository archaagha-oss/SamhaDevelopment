import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "default" | "compact";
}

export default function EmptyState({
  icon = "📭",
  title,
  description,
  actionLabel,
  onAction,
  variant = "default"
}: EmptyStateProps) {
  if (variant === "compact") {
    return (
      <div className="text-center py-4">
        <p className="text-slate-400 text-sm">{title}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-4xl mb-3 opacity-50">{icon}</div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-4" size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
