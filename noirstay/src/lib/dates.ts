// Date helpers kept outside component bodies so render stays pure.
export function isoInDays(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}
