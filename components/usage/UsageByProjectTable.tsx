import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { Table } from "@/components/ui/Table";
import { Empty } from "@/components/ui/Empty";
import { FolderOpen } from "lucide-react";
import { formatUsdCents } from "@/lib/format/currency";

type Row = {
  projectId: string;
  projectName: string;
  committedCents: number;
  count: number;
};

export function UsageByProjectTable({ rows }: { rows: Row[] }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="border-b">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-secondary">
            <FolderOpen aria-hidden="true" className="size-4" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">
            Spend by project
          </h2>
        </div>
        <CardDescription>
          Settled usage and pending reservations, grouped by project.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <Empty>
            <p className="text-sm text-muted-foreground">
              No project spend recorded yet.
            </p>
          </Empty>
        ) : (
          <Table aria-label="Spend by project">
            <thead className="bg-muted/60">
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Project</th>
                <th className="py-2 pr-4 font-medium">Operations</th>
                <th className="py-2 text-right font-medium">Committed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.projectId} className="border-b last:border-0">
                  <td className="min-w-44 max-w-lg break-words font-medium">
                    {row.projectName}
                  </td>
                  <td className="py-2 pr-4 tabular-nums">{row.count}</td>
                  <td className="py-2 text-right tabular-nums">
                    {formatUsdCents(row.committedCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
