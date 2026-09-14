export type ID = {
  client: string; //random id generated once per browser tab / replica
  clock: number; //client's own counter, incremented on every insertion it makes
}; //every char will be addressed by this 'ID' not indexes

export function idToString(id: ID): string {
  return `${id.client}:${id.clock}`;
}
export function idEquals(a: id | null, b: id | null): boolean {
  if (a == null || b == null) return a === b;
  return a.client == b.client && a.clock == b.clock;
}
