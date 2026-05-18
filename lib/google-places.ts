export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  website: string | null;
}

export async function searchPlaces(
  query: string,
  subarea: string,
  city: string
): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY not set");

  const searchQuery = `${query} in ${subarea}, ${city}, UK`;

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.websiteUri",
      },
      body: JSON.stringify({
        textQuery: searchQuery,
        maxResultCount: 20,
        locationBias: {
          rectangle: {
            low: { latitude: 49.9, longitude: -8.2 },
            high: { latitude: 60.9, longitude: 1.8 },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Places API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const places = data.places || [];

  return places.map((place: Record<string, unknown>) => ({
    placeId: place.id as string,
    name: (place.displayName as { text: string })?.text || "",
    address: (place.formattedAddress as string) || "",
    website: (place.websiteUri as string) || null,
  }));
}
