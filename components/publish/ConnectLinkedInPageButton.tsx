import { LinkedInMarkIcon } from "@/components/brand/LinkedInMarkIcon";
import { Button } from "@/components/ui/button";
import { LINKEDIN_PAGES_AUTHORIZE_PATH } from "@/lib/publishing/linkedin-pages-navigation";

export function ConnectLinkedInPageButton() {
  return (
    <Button
      className="h-auto gap-2.5 rounded-lg border-[#004182] bg-[#0a66c2] px-5 py-2.5 text-white hover:bg-[#004182]"
      nativeButton={false}
      render={<a href={LINKEDIN_PAGES_AUTHORIZE_PATH} />}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 transition-colors group-hover/button:bg-white/25">
        <LinkedInMarkIcon aria-hidden className="size-4" />
      </span>
      <span>Connect LinkedIn Page</span>
    </Button>
  );
}
