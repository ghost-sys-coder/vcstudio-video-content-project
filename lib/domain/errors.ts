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

export class ClerkSynchronizationError extends Error {
  readonly code = "CLERK_SYNCHRONIZATION_FAILED";

  constructor(message = "The authenticated user could not be synchronized.") {
    super(message);
    this.name = "ClerkSynchronizationError";
  }
}
