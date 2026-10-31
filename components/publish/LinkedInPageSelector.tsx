"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/FormSelect";
import { SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  LINKEDIN_PAGES_SELECTION_PATH,
  LINKEDIN_PAGES_PAGE_SIZE,
} from "@/lib/publishing/linkedin-pages-navigation";
import type { LinkedInPageSelectionState } from "@/lib/publishing/linkedin-pages-selection";

export function LinkedInPageSelector({
  action,
  pages,
  start,
  nextStart,
}: {
  action: (
    previous: LinkedInPageSelectionState,
    data: FormData,
  ) => Promise<LinkedInPageSelectionState>;
  pages: { id: string; name: string }[];
  start: number;
  nextStart: number | null;
}) {
  const submitting = useRef(false);
  const [state, submit, pending] = useActionState(
    async (previous: LinkedInPageSelectionState, data: FormData) => {
      try {
        return await action(previous, data);
      } finally {
        submitting.current = false;
      }
    },
    { error: null },
  );
  const [selectedPage, setSelectedPage] = useState("");
  return (
    <section className="app-page app-form-page">
      <header className="app-heading">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          LinkedIn Pages
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Choose a company Page
        </h1>
        <p className="text-muted-foreground">
          Choose the Page this workspace may publish social posts to. Connect
          with an approved LinkedIn Page administrator account.
        </p>
      </header>
      <form
        action={submit}
        aria-busy={pending}
        onSubmit={(event) => {
          if (submitting.current) event.preventDefault();
          else submitting.current = true;
        }}
        className="app-panel app-section min-w-0 rounded-xl border bg-card"
      >
        <input type="hidden" name="start" value={start} />
        {pages.length > 0 ? (
          <div className="min-w-0 space-y-2">
            <Label htmlFor="linkedin-page">LinkedIn Page</Label>
            <FormSelect
              id="linkedin-page"
              name="pageId"
              required
              value={selectedPage}
              onValueChange={setSelectedPage}
              disabled={pending}
            >
              <SelectItem value="">Choose a Page</SelectItem>
              {pages.map((page) => (
                <SelectItem key={page.id} value={page.id}>
                  {page.name}
                </SelectItem>
              ))}
            </FormSelect>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No eligible Pages were found in this set. Check your Page role and
            the app&apos;s Community Management permissions, or browse another
            set.
          </p>
        )}
        {state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending || pages.length === 0}>
            {pending ? "Working..." : "Connect Page"}
          </Button>
          <Button
            type="submit"
            name="intent"
            value="cancel"
            formNoValidate
            disabled={pending}
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </form>
      {start > 0 || nextStart !== null ? (
        <nav
          aria-label="LinkedIn Page results"
          className="flex flex-wrap gap-2"
        >
          {start > 0 ? (
            <Button
              disabled={pending}
              nativeButton={false}
              render={
                <Link
                  prefetch={false}
                  href={`${LINKEDIN_PAGES_SELECTION_PATH}?start=${start - LINKEDIN_PAGES_PAGE_SIZE}`}
                />
              }
              variant="outline"
            >
              Previous Pages
            </Button>
          ) : null}
          {nextStart !== null ? (
            <Button
              disabled={pending}
              nativeButton={false}
              render={
                <Link
                  prefetch={false}
                  href={`${LINKEDIN_PAGES_SELECTION_PATH}?start=${nextStart}`}
                />
              }
              variant="outline"
            >
              More Pages
            </Button>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
