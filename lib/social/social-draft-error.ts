export class SocialDraftDestinationError extends Error {
  constructor() {
    super("Choose destination accounts that belong to this workspace.");
    this.name = "SocialDraftDestinationError";
  }
}
