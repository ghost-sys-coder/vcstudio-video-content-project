import { CheckCheck, FolderLock, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";

const safeguards = [
  {
    icon: FolderLock,
    title: "Access stays specific",
    description:
      "Each application uses only the workspaces and permissions you grant.",
  },
  {
    icon: CheckCheck,
    title: "Choose your publishing control",
    description:
      "Keep manual review, or explicitly authorize autonomous publishing for a connection and workspace.",
  },
  {
    icon: Unplug,
    title: "Disconnect when you choose",
    description:
      "Future actions stop. Already-approved schedules stay on your Social calendar.",
  },
];

export function McpAccessOverview() {
  return (
    <Card className="min-w-0 bg-secondary/25 shadow-none">
      <CardHeader>
        <h2 className="text-lg font-semibold tracking-tight">
          You stay in control
        </h2>
        <CardDescription>
          Connecting an assistant starts with permission.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-5">
          {safeguards.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex items-start gap-3">
              <Icon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              />
              <div className="min-w-0 space-y-1">
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="mt-auto flex-wrap gap-3 bg-transparent">
        <Badge variant="outline">Marketing paused</Badge>
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
          Secure upload and browser review are available when a client cannot
          transfer files or show an interactive review.
        </p>
      </CardFooter>
    </Card>
  );
}
