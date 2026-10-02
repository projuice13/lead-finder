export const CATEGORIES = [
  "Cafes & Coffee Shops",
  "Gyms & Fitness Centres",
  "Padel Courts",
  "Tennis & Squash Courts",
  "Farm Shops",
  "Garden Centres",
  "Golf Clubs",
  "Mobile Catering & Food Trucks",
  "Dessert Parlours",
  "Holiday & Caravan Parks",
  "Spa's & Health Centres",
  "Bakeries",
  "Restaurants",
  "Juice Bars",
  "Artisan Ice Cream Manufacturers",
  "Smoothie, Acai and Poke Bowl bars",
  "Jam manufacturers",
  "Event catering",
  "Gelato Parlours",
  // Temporary trade & professional-services categories
  "Plumbers",
  "Electricians",
  "Carpenters & Joiners",
  "Cleaning Companies",
  "Accountants",
  "Lawyers",
];

// Per-category search tuning. Google Places text search is fuzzy, so for niche
// categories the bare label pulls in loosely-related places (e.g. ordinary cafes
// for "smoothie bars"). A config here lets us:
//   - send several targeted queries instead of the one label, then
//   - keep only places whose NAME or Google place-TYPE actually matches.
// Categories with no entry behave exactly as before: query = the label, no filter.
export interface CategorySearch {
  queries?: string[];   // search strings sent to Google (default: [category label])
  nameMatch?: string[]; // keep if the place name contains any of these (lowercased, accent-stripped)
  typeMatch?: string[]; // keep if the place's Google types include any of these
}

export const CATEGORY_SEARCH: Record<string, CategorySearch> = {
  "Smoothie, Acai and Poke Bowl bars": {
    queries: ["smoothie bar", "acai bowl shop", "poke bowl bar", "juice and smoothie bar"],
    nameMatch: ["smoothie", "acai", "poke", "juice", "bowl"],
    typeMatch: ["acai_shop", "juice_shop"],
  },
};

// Big chain / franchise names to exclude from results — case-insensitive partial match
export const BLOCKED_CHAINS = [
  // Supermarkets
  "sainsbury", "tesco", "asda", "morrisons", "waitrose", "aldi", "lidl",
  "co-op", "coop", "the co-operative", "marks & spencer", "marks and spencer",
  "m&s", "iceland", "spar", "budgens", "costcutter", "nisa", "londis",
  // Coffee chains
  "starbucks", "costa coffee", "caffe nero", "pret a manger", "pret",
  "greggs", "subway", "mcdonald", "burger king", "kfc", "nando",
  "pizza hut", "domino", "papa john", "five guys", "shake shack",
  "wagamama", "zizzi", "ask italian", "bella italia", "pizza express",
  "frankie & benny", "harvester", "toby carvery", "brewers fayre",
  "wetherspoon", "j.d. wetherspoon",
  // Gyms/fitness chains
  "pure gym", "puregym", "the gym group", "david lloyd", "nuffield health",
  "virgin active", "anytime fitness", "bannatyne", "better gym",
  "everyone active", "fitness first",
  // Spas/health chains
  "holland & barrett", "the body shop",
  // Garden/retail chains
  "dobbies", "homebase", "b&q",
];

export function isBlockedChain(name: string): boolean {
  const lower = name.toLowerCase();
  return BLOCKED_CHAINS.some((chain) => lower.includes(chain.toLowerCase()));
}

export const UK_CITIES = [
  "Manchester",
  "London",
  "Birmingham",
  "Leeds",
  "Liverpool",
  "Edinburgh",
  "Glasgow",
  "Bristol",
  "Sheffield",
  "Bath",
  "Oxford",
  "Gloucester",
  "Northampton",
  "Leicester",
  "Coventry",
  "Cambridge",
];
