import { redirect } from "next/navigation";

/** The section has no landing screen of its own yet; posts are its entry point. */
export default function SocialPage() {
  redirect("/app/social/posts");
}
