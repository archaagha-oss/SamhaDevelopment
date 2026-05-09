import { UnitImage } from "../types";

interface Props {
  images: UnitImage[];
  onOpenFloorPlan: (image: UnitImage) => void;
}

export default function UnitFloorPlans({ images, onOpenFloorPlan }: Props) {
  const floorPlans = images.filter((img) => img.type === "FLOOR_PLAN");
  const floorMaps  = images.filter((img) => img.type === "FLOOR_MAP");

  if (floorPlans.length === 0 && floorMaps.length === 0) return null;

  const renderGrid = (items: UnitImage[]) => (
    <div className="grid grid-cols-2 gap-3">
      {items.map((plan) => (
        <button
          key={plan.id}
          onClick={() => onOpenFloorPlan(plan)}
          className="group relative rounded-lg overflow-hidden border-2 border-border hover:border-primary/40 transition-colors"
        >
          <img
            src={plan.url}
            alt={plan.caption || "Image"}
            className="w-full h-32 object-cover group-hover:brightness-110 transition-all"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <span className="text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity">👁️</span>
          </div>
          {plan.caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 truncate">
              {plan.caption}
            </div>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {floorPlans.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            Floor Plans
            <span className="ml-2 bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full text-xs">
              {floorPlans.length}
            </span>
          </p>
          {renderGrid(floorPlans)}
        </div>
      )}

      {floorMaps.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            Floor Location Map
            <span className="ml-2 bg-warning-soft text-warning px-1.5 py-0.5 rounded-full text-xs">
              {floorMaps.length}
            </span>
          </p>
          {renderGrid(floorMaps)}
        </div>
      )}
    </div>
  );
}
