import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsdCents } from "@/lib/format/currency";

type Row = {
  projectId: string;
  projectName: string;
  committedCents: number;
  count: number;
};

export function UsageByProjectTable({ rows }: { rows: Row[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spend by project</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No project spend recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Project</th>
                  <th className="py-2 pr-4 font-medium">Operations</th>
                  <th className="py-2 text-right font-medium">Committed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.projectId} className="border-b last:border-0">
                    <td className="py-2 pr-4">{row.projectName}</td>
                    <td className="py-2 pr-4 tabular-nums">{row.count}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatUsdCents(row.committedCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
