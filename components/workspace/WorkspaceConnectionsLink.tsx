import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { WORKSPACE_CONNECTIONS_PATH } from "@/lib/publishing/connections-navigation";

export function WorkspaceConnectionsLink() {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold tracking-tight">
          Accounts &amp; connections
        </h2>
        <CardDescription>
          Manage publishing destinations and review posting requirements in
          Social.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          nativeButton={false}
          render={<Link href={WORKSPACE_CONNECTIONS_PATH} />}
          variant="outline"
        >
          Open accounts &amp; connections
        </Button>
      </CardContent>
    </Card>
  );
}
