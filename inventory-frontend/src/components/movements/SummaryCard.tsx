export default function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500">
          {label}
        </span>

        <span className="text-zinc-400">
          {icon}
        </span>
      </div>

      <p className="text-2xl font-semibold text-zinc-900">
        {value}
      </p>
    </div>
  );
}