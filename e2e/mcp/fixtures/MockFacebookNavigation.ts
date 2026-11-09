export function unstable_rethrow(error: unknown) {
  if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT"))
    throw error;
}
