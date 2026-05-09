interface SummaryCardProps {
  label: string;
  value: number;
  color: string;
}

export default function SummaryCard({ label, value, color }: SummaryCardProps) {
  return (
    <div className="bg-card rounded-lg shadow p-4">
      <p className="text-sm text-muted-foreground mb-2">{label}</p>
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-bold text-white px-4 py-2 rounded ${color}`}>
          {value}
        </span>
      </div>
    </div>
  );
}
