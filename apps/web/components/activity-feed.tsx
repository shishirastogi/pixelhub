import { Badge, Card, CardTitle } from "@/components/ui";
import { initials, timeAgo } from "@/lib/utils";

export interface ActivityItem {
  id: string;
  type: string;
  entityType: string;
  createdAt: string | Date;
  actor?: { name: string } | null;
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card className="h-full">
      <CardTitle
        hint={
          <Badge tone="neutral">
            {items.length} event{items.length === 1 ? "" : "s"}
          </Badge>
        }
      >
        Live Activity Stream
      </CardTitle>
      {items.length === 0 ? (
        <p className="text-xs text-[#6B6860]">No activity recorded yet.</p>
      ) : (
        <ul className="divide-y divide-[#F4F2ED]">
          {items.map((item) => {
            const actorName = item.actor?.name ?? "System";
            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-2.5 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F4F2ED] text-[10px] font-semibold text-[#141413]">
                    {initials(actorName)}
                  </span>
                  <span>
                    <span className="font-semibold text-[#141413]">
                      {actorName}
                    </span>{" "}
                    <span className="text-[#6B6860]">
                      {item.type.replace(/\./g, " · ")}
                    </span>
                  </span>
                </div>
                <span className="whitespace-nowrap text-[11px] text-[#9A968C]">
                  {timeAgo(item.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
