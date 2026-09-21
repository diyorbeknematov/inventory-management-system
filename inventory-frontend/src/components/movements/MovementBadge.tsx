import type {
  MovementStatus,
  MovementType,
} from "../../types/movement";

export function MovementTypeBadge({
  type,
}: {
  type: MovementType;
}) {
  return (
    <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
      {type}
    </span>
  );
}


export function StatusBadge({
  status,
}: {
  status: MovementStatus;
}) {
  const styles: Record<
    MovementStatus,
    string
  > = {
    DRAFT: "bg-zinc-100 text-zinc-600",
    SENT: "bg-yellow-100 text-yellow-700",
    ACCEPTED:
      "bg-green-100 text-green-700",
    REJECTED:
      "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}