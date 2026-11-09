"use server";
import {
  checkLibraryInspections,
  retryLibraryInspection,
} from "@/lib/media/library-inspection-service";
export async function checkLibraryInspectionsAction(input: unknown) {
  return checkLibraryInspections(input);
}
export async function retryLibraryInspectionAction(input: unknown) {
  return retryLibraryInspection(input);
}
