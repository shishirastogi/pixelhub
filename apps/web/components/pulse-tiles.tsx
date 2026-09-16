import { Badge, Card, CardTitle, Donut, ProgressBar } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

type Severity = "INFO" | "WARNING" | "ERROR";

export interface PulseData {
  deliverables: { done: number; total: number };
  requirementCoveragePct: number;
  fulfilledRequirements: number;
  acceptedRequirements: number;
  openTasks: number;
  currentBranch: { id: string; name: string; kind: string } | null;
  latestVersion: {
    id: string;
    number: number;
    label: string | null;
    createdAt: string | Date;
  } | null;
  attentionItems: Array<{
    type: string;
    severity: Severity;
    title: string;
    message: string;
    entityType: string;
    entityId: string;
  }>;
}

const SEVERITY_TONE: Record<Severity, "info" | "warning" | "danger"> = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "danger",
};

export function PulseTiles({ pulse }: { pulse: PulseData }) {
  const { done, total } = pulse.deliverables;
  const deliverablePct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardTitle>Deliverables</CardTitle>
          <div className="mb-3 text-3xl font-semibold">
            {done}
            <span className="text-lg text-neutral-400">/{total}</span>
          </div>
          <ProgressBar value={deliverablePct} />
          <p className="mt-2 text-xs text-neutral-500">
            {pulse.fulfilledRequirements}/{pulse.acceptedRequirements}{" "}
            requirements fulfilled
          </p>
        </Card>

        <Card>
          <CardTitle>Requirement coverage</CardTitle>
          <Donut value={pulse.requirementCoveragePct} label="fulfilled" />
        </Card>

        <Card>
          <CardTitle>Current version</CardTitle>
          {pulse.currentBranch ? (
            <div>
              <p className="text-lg font-medium">{pulse.currentBranch.name}</p>
              {pulse.latestVersion ? (
                <p className="mt-1 text-sm text-neutral-500">
                  v{pulse.latestVersion.number}
                  {pulse.latestVersion.label
                    ? ` · ${pulse.latestVersion.label}`
                    : ""}{" "}
                  · {timeAgo(pulse.latestVersion.createdAt)}
                </p>
              ) : (
                <p className="mt-1 text-sm text-neutral-500">
                  No snapshot yet
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No branch</p>
          )}
        </Card>

        <Card>
          <CardTitle>Open tasks</CardTitle>
          <div className="text-3xl font-semibold">{pulse.openTasks}</div>
          <p className="mt-1 text-xs text-neutral-500">To do + in progress</p>
        </Card>
      </div>

      <Card>
        <CardTitle
          hint={
            <Badge
              tone={pulse.attentionItems.length > 0 ? "warning" : "success"}
            >
              {pulse.attentionItems.length} item
              {pulse.attentionItems.length === 1 ? "" : "s"}
            </Badge>
          }
        >
          Needs attention
        </CardTitle>
        {pulse.attentionItems.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nothing needs attention right now.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {pulse.attentionItems.map((item, index) => (
              <li
                key={`${item.entityId}-${index}`}
                className="flex items-start justify-between gap-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-neutral-500">{item.message}</p>
                </div>
                <Badge tone={SEVERITY_TONE[item.severity]}>
                  {item.severity}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
