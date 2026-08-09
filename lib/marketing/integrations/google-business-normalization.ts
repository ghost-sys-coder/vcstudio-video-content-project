import type { GoogleBusinessLocationData } from "@/db/schema";

type GoogleTime = { hours?: number; minutes?: number };
type GooglePeriod = {
  openDay?: string;
  openTime?: GoogleTime;
  closeDay?: string;
  closeTime?: GoogleTime;
};

export type GoogleBusinessLocationInput = {
  title?: string;
  storeCode?: string;
  websiteUri?: string;
  phoneNumbers?: { primaryPhone?: string; additionalPhones?: string[] };
  categories?: {
    primaryCategory?: { displayName?: string };
    additionalCategories?: { displayName?: string }[];
  };
  profile?: { description?: string };
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  regularHours?: { periods: GooglePeriod[] };
  serviceArea?: { places?: { placeInfos?: { placeName?: string }[] } };
};

function formatTime(value: GoogleTime | undefined): string {
  if (!value) return "";
  return `${String(value.hours ?? 0).padStart(2, "0")}:${String(value.minutes ?? 0).padStart(2, "0")}`;
}

export function normalizeGoogleBusinessLocation(
  input: GoogleBusinessLocationInput,
): GoogleBusinessLocationData {
  const primaryCategory = input.categories?.primaryCategory?.displayName ?? "";
  return {
    title: input.title ?? "",
    storeCode: input.storeCode ?? "",
    categories: [
      primaryCategory,
      ...(input.categories?.additionalCategories ?? []).map(
        (category) => category.displayName ?? "",
      ),
    ].filter(Boolean),
    primaryCategory,
    description: input.profile?.description ?? "",
    websiteUri: input.websiteUri ?? "",
    phoneNumbers: [
      input.phoneNumbers?.primaryPhone ?? "",
      ...(input.phoneNumbers?.additionalPhones ?? []),
    ].filter(Boolean),
    addressLines: input.storefrontAddress?.addressLines ?? [],
    locality: input.storefrontAddress?.locality ?? "",
    administrativeArea: input.storefrontAddress?.administrativeArea ?? "",
    postalCode: input.storefrontAddress?.postalCode ?? "",
    regionCode: input.storefrontAddress?.regionCode ?? "",
    regularHours: (input.regularHours?.periods ?? []).map((period) =>
      `${period.openDay ?? ""} ${formatTime(period.openTime)}-${period.closeDay ?? period.openDay ?? ""} ${formatTime(period.closeTime)}`.trim(),
    ),
    serviceArea: (input.serviceArea?.places?.placeInfos ?? [])
      .map((place) => place.placeName ?? "")
      .filter(Boolean)
      .join(", "),
  };
}
