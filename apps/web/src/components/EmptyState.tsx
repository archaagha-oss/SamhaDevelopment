// Compatibility shim — the canonical version lives in components/ui/EmptyState.tsx.
// Old import paths (`from "./EmptyState"`) keep working.
import { ReactNode } from "react";
import { EmptyState as UiEmptyState } from "./ui/EmptyState";
import { Button } from "./ui/Button";

interface Props {
  icon?: string | ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon, title, description, action }: Props) {
  // Older callers passed an emoji string for `icon`. Render it as text inside the new component.
  const renderedIcon = typeof icon === "string" ? <span className="text-3xl opacity-60">{icon}</span> : icon;
  return (
    <UiEmptyState
      icon={renderedIcon}
      title={title}
      description={description}
      action={action ? <Button onClick={action.onClick}>{action.label}</Button> : undefined}
    />
  );
}
