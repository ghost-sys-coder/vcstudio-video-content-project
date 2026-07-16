import Link from "next/link";
import type { Character } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CharacterCard({ character }: { character: Character }) {
  return (
    <Link className="group block" href={`/app/characters/${character.id}`}>
      <Card className="h-full transition-colors group-hover:border-primary/50">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{character.name}</CardTitle>
            <Badge
              variant={character.status === "active" ? "default" : "secondary"}
            >
              {character.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {character.description ||
              character.visualIdentity ||
              "No description added yet."}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
