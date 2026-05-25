import type { OwnedCreature } from "@workspace/api-client-react";

export function normalizeCreatureList(data: unknown): OwnedCreature[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.creatures)) return obj.creatures as OwnedCreature[];
    if (Array.isArray(obj.data)) return obj.data as OwnedCreature[];
    if (Array.isArray(obj.inventory)) return obj.inventory as OwnedCreature[];
  }
  return [];
}
