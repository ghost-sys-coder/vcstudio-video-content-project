import { LinkedInMarkIcon } from "@/components/brand/LinkedInMarkIcon";
import { Button } from "@/components/ui/button";
import { LINKEDIN_PAGES_AUTHORIZE_PATH } from "@/lib/publishing/linkedin-pages-navigation";

export function ConnectLinkedInPageButton() {
  return (
    <Button
      className="h-10 border-[#004182] bg-[#0a66c2] text-white hover:bg-[#004182]"
      nativeButton={false}
      render={<a href={LINKEDIN_PAGES_AUTHORIZE_PATH} />}
    >
      <LinkedInMarkIcon aria-hidden className="size-4" />
      Connect LinkedIn Page
    </Button>
  );
}
