/**
 * Per-platform metadata limits, kept free of any server-only import so both the
 * request schema (shared with client components) and the provider can use them.
 *
 * Values mirror what the platform enforces server-side; exceeding them is a hard
 * rejection, so validating locally turns a confusing provider 400 into a clear
 * field-level error.
 */
export const YOUTUBE_TITLE_MAX_LENGTH = 100;
export const YOUTUBE_DESCRIPTION_MAX_LENGTH = 5000;
export const MAX_PUBLICATION_TAGS = 15;
export const MAX_PUBLICATION_TAG_LENGTH = 30;
