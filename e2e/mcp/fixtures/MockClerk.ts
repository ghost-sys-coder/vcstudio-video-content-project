export { MockSignedOut as Show } from "./MockSignedOut";
export {
  MockClerkButton as SignInButton,
  MockClerkButton as SignOutButton,
} from "./MockClerkButton";

export function useWaitlist() {
  return {
    waitlist: {
      id: "",
      join: async (input: { emailAddress: string }) => {
        document.body.dataset.submissions = String(
          Number(document.body.dataset.submissions ?? 0) + 1,
        );
        document.body.dataset.email = input.emailAddress;
        await new Promise((resolve) => setTimeout(resolve, 120));
        return {
          error: new URLSearchParams(location.search).has("fail")
            ? new Error("Mocked waitlist failure")
            : null,
        };
      },
    },
    errors: { fields: {} },
    fetchStatus: "idle",
  };
}
