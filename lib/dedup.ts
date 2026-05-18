export function createDeduplicator() {
  const seen = new Set<string>();

  return {
    has(placeId: string): boolean {
      return seen.has(placeId);
    },
    add(placeId: string): void {
      seen.add(placeId);
    },
    size(): number {
      return seen.size;
    },
  };
}
