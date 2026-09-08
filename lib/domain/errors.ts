export class AuthenticationRequiredError extends Error {
  readonly code = "AUTHENTICATION_REQUIRED";

  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
  }
}

export class WorkspaceAccessDeniedError extends Error {
  readonly code = "WORKSPACE_ACCESS_DENIED";

  constructor() {
    super("You do not have access to this workspace.");
    this.name = "WorkspaceAccessDeniedError";
  }
}

export class WorkspacePermissionDeniedError extends Error {
  readonly code = "WORKSPACE_PERMISSION_DENIED";

  constructor() {
    super("Your workspace role does not permit this action.");
    this.name = "WorkspacePermissionDeniedError";
  }
}

export type BudgetLimitScope =
  "project" | "workspace_daily" | "workspace_monthly";

export class BudgetExceededError extends Error {
  readonly code = "BUDGET_EXCEEDED";

  constructor(readonly scope: BudgetLimitScope) {
    super(`The ${scope.replaceAll("_", " ")} budget would be exceeded.`);
    this.name = "BudgetExceededError";
  }
}

export type MarketingBudgetLimitScope =
  | "workspace_daily"
  | "workspace_monthly"
  | "marketing_monthly"
  | "schedule_rule";

/**
 * Separate from `BudgetExceededError` because the marketing path can hit two
 * limits the project pipeline has no concept of — the marketing sub-cap and a
 * single schedule rule's cap — and the UI has to say which, or the user is left
 * guessing why an action they can afford was refused.
 */
export class MarketingBudgetExceededError extends Error {
  readonly code = "MARKETING_BUDGET_EXCEEDED";

  constructor(readonly scope: MarketingBudgetLimitScope) {
    super(`The ${scope.replaceAll("_", " ")} budget would be exceeded.`);
    this.name = "MarketingBudgetExceededError";
  }
}

export class RateLimitExceededError extends Error {
  readonly code = "RATE_LIMIT_EXCEEDED";

  constructor(readonly operation: string) {
    super("Too many requests. Please wait a moment and try again.");
    this.name = "RateLimitExceededError";
  }
}

export class ClerkSynchronizationError extends Error {
  readonly code = "CLERK_SYNCHRONIZATION_FAILED";

  constructor(message = "The authenticated user could not be synchronized.") {
    super(message);
    this.name = "ClerkSynchronizationError";
  }
}

export class LastWorkspaceOwnerError extends Error {
  readonly code = "LAST_WORKSPACE_OWNER";

  constructor() {
    super(
      "A workspace must always have at least one owner. Assign another owner before changing this role.",
    );
    this.name = "LastWorkspaceOwnerError";
  }
}

export class WorkspaceInvitationNotFoundError extends Error {
  readonly code = "WORKSPACE_INVITATION_NOT_FOUND";

  constructor() {
    super("This invitation is no longer valid.");
    this.name = "WorkspaceInvitationNotFoundError";
  }
}

export class WorkspaceInvitationEmailMismatchError extends Error {
  readonly code = "WORKSPACE_INVITATION_EMAIL_MISMATCH";

  constructor() {
    super(
      "This invitation was sent to a different email address than the one you're signed in with.",
    );
    this.name = "WorkspaceInvitationEmailMismatchError";
  }
}

/**
 * Why a custom-voice provider call failed, at the granularity the user can act
 * on. The distinction that matters most is `provider_unavailable`: the account
 * or the API itself has no custom-voice endpoints, so no amount of re-recording
 * will help and the UI must stop blaming the recording.
 */
export type CustomVoiceProviderFailure =
  | "provider_unavailable"
  | "unauthorized"
  | "recording_rejected"
  | "rate_limited"
  | "provider_error";

export class CustomVoiceProviderError extends Error {
  readonly code = "CUSTOM_VOICE_PROVIDER_ERROR";

  constructor(
    readonly failure: CustomVoiceProviderFailure,
    readonly status: number | null,
    readonly providerMessage: string | null,
    readonly requestId: string | null,
  ) {
    super(`CUSTOM_VOICE_${failure.toUpperCase()}`);
    this.name = "CustomVoiceProviderError";
  }
}
