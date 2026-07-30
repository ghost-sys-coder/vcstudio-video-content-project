"use client";

import type { Editor } from "@tiptap/react";
import {
  BoldIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  Unlink2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Formatting controls for the post body.
 *
 * Deliberately short: it only offers what the stored document can express and
 * the plain-text flattener can honestly carry. There is no heading, colour, or
 * font control, because no platform in this app renders one.
 */
export function PostEditorToolbar({
  disabled,
  editor,
}: {
  disabled: boolean;
  editor: Editor;
}) {
  const linkActive = editor.isActive("link");

  function toggleLink() {
    if (linkActive) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const href = window.prompt("Link to (https://…)");
    if (!href) return;
    if (!/^https?:\/\//i.test(href)) {
      window.alert("Links must start with http:// or https://");
      return;
    }
    editor.chain().focus().setLink({ href }).run();
  }

  const controls = [
    {
      label: "Bold",
      icon: BoldIcon,
      active: editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: ItalicIcon,
      active: editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Bulleted list",
      icon: ListIcon,
      active: editor.isActive("bulletList"),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrderedIcon,
      active: editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 border-b p-1.5">
      {controls.map((control) => (
        <Button
          aria-label={control.label}
          aria-pressed={control.active}
          disabled={disabled}
          key={control.label}
          onClick={control.run}
          size="icon-sm"
          type="button"
          variant={control.active ? "secondary" : "ghost"}
        >
          <control.icon />
        </Button>
      ))}
      <Button
        aria-label={linkActive ? "Remove link" : "Add link"}
        aria-pressed={linkActive}
        disabled={disabled}
        onClick={toggleLink}
        size="icon-sm"
        type="button"
        variant={linkActive ? "secondary" : "ghost"}
      >
        {linkActive ? <Unlink2Icon /> : <LinkIcon />}
      </Button>
      <p className="ml-auto pr-1 text-xs text-muted-foreground">
        Bold and italic are for drafting — platforms receive plain text.
      </p>
    </div>
  );
}
