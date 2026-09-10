"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TitleSuggestionView } from "@/lib/titles/title-view";

/**
 * The title this release will actually use.
 *
 * A suggestion can be copied in with one click, but nothing is applied on its
 * own. Once a title is here it stays, even if someone favourites a different
 * suggestion afterwards: a release must publish what a person chose, not
 * whatever the gallery currently prefers.
 */
export function ReleaseTitleChooser({
  value,
  suggestions,
  disabled,
  onChange,
}: {
  value: string;
  suggestions: TitleSuggestionView[];
  disabled: boolean;
  onChange: (input: {
    title: string;
    titleSuggestionId: string | null;
  }) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="release-title">Title</Label>
      <Input
        disabled={disabled}
        id="release-title"
        maxLength={300}
        onChange={(event) =>
          // Typing over a suggestion makes it the creator's own wording, so the
          // provenance pointer is dropped rather than left claiming a source.
          onChange({ title: event.target.value, titleSuggestionId: null })
        }
        placeholder="The title viewers will see"
        value={value}
      />
      {suggestions.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Suggestions. Choosing one copies it here; it is not applied until
            you save.
          </p>
          <ul className="space-y-1">
            {suggestions.slice(0, 5).map((suggestion) => (
              <li key={suggestion.id}>
                <button
                  className="w-full rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted disabled:opacity-60"
                  disabled={disabled}
                  onClick={() =>
                    onChange({
                      title: suggestion.text,
                      titleSuggestionId: suggestion.id,
                    })
                  }
                  type="button"
                >
                  <span className="block">{suggestion.text}</span>
                  {suggestion.isFavorite ? (
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      Favourited in the gallery
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
