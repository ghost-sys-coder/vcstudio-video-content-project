"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { PostEditorToolbar } from "@/components/social/PostEditorToolbar";
import type { PortableDocument } from "@/lib/social/portable-document";

/**
 * The rich text surface for a post body.
 *
 * The extension set is pruned down to exactly what `portableDocumentSchema`
 * accepts and `renderPortableDocumentToPlainText` can flatten honestly. Anything
 * a platform would silently drop — headings, code blocks, block quotes,
 * horizontal rules, strikethrough, underline — is turned off here rather than
 * offered and then thrown away at publish time.
 *
 * The editor is uncontrolled: Tiptap owns the ProseMirror document and reports
 * changes upward. Feeding its own value back in on every keystroke would fight
 * the editor for cursor position.
 */
export function PostBodyEditor({
  editable,
  initialDocument,
  onChange,
}: {
  editable: boolean;
  initialDocument: PortableDocument;
  onChange: (document: PortableDocument) => void;
}) {
  const editor = useEditor({
    editable,
    // Rendering happens on the client only; without this Tiptap warns about a
    // server/client markup mismatch during hydration.
    immediatelyRender: false,
    content: initialDocument,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: {
          openOnClick: false,
          autolink: true,
          // Mirrors the storage schema, which rejects any other scheme.
          protocols: ["http", "https"],
        },
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "min-h-56 w-full px-3 py-2 text-sm outline-none [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5",
        "aria-label": "Post body",
      },
    },
    onUpdate: ({ editor: instance }) => {
      // Cast at this one boundary: Tiptap types its JSON as a loose record, and
      // the server re-validates with `portableDocumentSchema` regardless — this
      // value is never trusted on the way in.
      onChange(instance.getJSON() as PortableDocument);
    },
  });

  if (!editor) return null;

  return (
    <div className="rounded-xl border focus-within:ring-2 focus-within:ring-ring">
      <PostEditorToolbar disabled={!editable} editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
