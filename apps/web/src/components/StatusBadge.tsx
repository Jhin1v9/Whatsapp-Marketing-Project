import { getBadgeClass, type BadgeTone } from "../lib/statusMaps";

type StatusBadgeProps = {
  readonly tone: BadgeTone;
  readonly label: string;
};

export function StatusBadge({ tone, label }: StatusBadgeProps): JSX.Element {
  return <span className={getBadgeClass(tone)}>{label}</span>;
}
