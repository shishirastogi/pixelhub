import { Card, CardTitle } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

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
      <CardTitle>Recent activity</CardTitle>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">No activity yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">
                  {item.actor?.name ?? "System"}
                </span>{" "}
                <span className="text-neutral-500">{item.type}</span>
              </span>
              <span className="whitespace-nowrap text-xs text-neutral-400">
                {timeAgo(item.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
