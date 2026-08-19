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
  // Temporary trade & professional-services categories
  "Plumbers",
  "Electricians",
  "Carpenters & Joiners",
  "Cleaning Companies",
  "Accountants",
  "Lawyers",
];

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
