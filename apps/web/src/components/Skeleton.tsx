interface SkeletonProps {
  variant?: "text" | "circular" | "rectangular";
  width?: string;
  height?: string;
  count?: number;
}

export default function Skeleton({
  variant = "rectangular",
  width = "100%",
  height = "20px",
  count = 1
}: SkeletonProps) {
  const baseClass = "bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse";

  const getShape = () => {
    switch (variant) {
      case "text": return "rounded";
      case "circular": return "rounded-full";
      case "rectangular": return "rounded-lg";
      default: return "rounded";
    }
  };

  const skeletons = Array(count).fill(null).map((_, i) => (
    <div
      key={i}
      className={`${baseClass} ${getShape()}`}
      style={{ width, height, marginBottom: i < count - 1 ? "8px" : "0" }}
    />
  ));

  return <>{skeletons}</>;
}
