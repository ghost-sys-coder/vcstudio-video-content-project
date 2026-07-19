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
