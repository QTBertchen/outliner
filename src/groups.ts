import OBR, { Item, Metadata } from "@owlbear-rodeo/sdk";
import { isPlainObject, lerp } from "./helpers";

/** Scene metadata key holding the `Group[]` definitions */
export const GROUPS_METADATA_KEY = "rodeo.owlbear.outliner/groups";
/** Item metadata key holding the id of the group the item belongs to */
export const GROUP_MEMBER_METADATA_KEY = "rodeo.owlbear.outliner/group";

export interface Group {
  id: string;
  name: string;
  layer: Item["layer"];
  /** `null` when the group sits at the root of its layer */
  parentId: string | null;
  /** Ordering on the same number line as item zIndexes (lists sort descending) */
  zIndex: number;
}

/** A row in a layer's outline: either an item or a group with nested rows */
export type Row =
  | { type: "item"; item: Item }
  | { type: "group"; group: Group; children: Row[] };

export function getRowId(row: Row): string {
  return row.type === "item" ? row.item.id : row.group.id;
}

export function getRowZIndex(row: Row): number {
  return row.type === "item" ? row.item.zIndex : row.group.zIndex;
}

/** Collect all items in a row subtree, including nested groups */
export function getRowItems(rows: Row[]): Item[] {
  const items: Item[] = [];
  for (const row of rows) {
    if (row.type === "item") {
      items.push(row.item);
    } else {
      items.push(...getRowItems(row.children));
    }
  }
  return items;
}

function isGroup(value: unknown): value is Group {
  return (
    isPlainObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.layer === "string" &&
    (value.parentId === null || typeof value.parentId === "string") &&
    typeof value.zIndex === "number"
  );
}

export function getGroups(metadata: Metadata): Group[] {
  const groups = metadata[GROUPS_METADATA_KEY];
  if (Array.isArray(groups)) {
    return groups.filter(isGroup);
  }
  return [];
}

export function getItemGroupId(item: Item): string | undefined {
  const groupId = item.metadata[GROUP_MEMBER_METADATA_KEY];
  return typeof groupId === "string" ? groupId : undefined;
}

export async function updateGroups(update: (groups: Group[]) => Group[]) {
  const metadata = await OBR.scene.getMetadata();
  await OBR.scene.setMetadata({
    [GROUPS_METADATA_KEY]: update(getGroups(metadata)),
  });
}

export async function createGroup(layer: Item["layer"], zIndex: number) {
  const group: Group = {
    id: crypto.randomUUID(),
    name: "New group",
    layer,
    parentId: null,
    zIndex,
  };
  await updateGroups((groups) => [...groups, group]);
}

export async function renameGroup(id: string, name: string) {
  await updateGroups((groups) =>
    groups.map((group) => (group.id === id ? { ...group, name } : group))
  );
}

/**
 * Delete a group, re-parenting its child groups and member items
 * to the deleted group's parent (items are kept, not deleted)
 */
export async function deleteGroup(id: string) {
  const metadata = await OBR.scene.getMetadata();
  const groups = getGroups(metadata);
  const group = groups.find((g) => g.id === id);
  if (!group) {
    return;
  }

  await OBR.scene.setMetadata({
    [GROUPS_METADATA_KEY]: groups
      .filter((g) => g.id !== id)
      .map((g) =>
        g.parentId === id ? { ...g, parentId: group.parentId } : g
      ),
  });

  const members = await OBR.scene.items.getItems(
    (item) => getItemGroupId(item) === id
  );
  if (members.length > 0) {
    await OBR.scene.items.updateItems(members, (items) => {
      for (const item of items) {
        if (group.parentId) {
          item.metadata[GROUP_MEMBER_METADATA_KEY] = group.parentId;
        } else {
          delete item.metadata[GROUP_MEMBER_METADATA_KEY];
        }
      }
    });
  }
}

/** Is `id` the same group as `ancestorId` or nested anywhere inside it */
export function isSelfOrDescendantGroup(
  groups: Group[],
  ancestorId: string,
  id: string
): boolean {
  const visited = new Set<string>();
  let current: string | null = id;
  while (current && !visited.has(current)) {
    if (current === ancestorId) {
      return true;
    }
    visited.add(current);
    current = groups.find((g) => g.id === current)?.parentId ?? null;
  }
  return false;
}

/**
 * Generate `count` zIndexes for a drop slot, in descending (list) order.
 * `upper` is the zIndex of the row above the slot and `lower` the row below;
 * either may be missing at the edges of a list.
 */
export function distributeZIndexes(
  upper: number | undefined,
  lower: number | undefined,
  count: number
): number[] {
  const zIndexes: number[] = [];
  if (upper !== undefined && lower !== undefined) {
    // Evenly distribute between the bounds (same approach as item reordering)
    const alpha = 1 / (count + 1);
    for (let i = 1; i <= count; i++) {
      zIndexes.push(lerp(upper, lower, alpha * i));
    }
  } else if (upper !== undefined) {
    for (let i = 1; i <= count; i++) {
      zIndexes.push(upper - i);
    }
  } else if (lower !== undefined) {
    for (let i = count; i >= 1; i--) {
      zIndexes.push(lower + i);
    }
  } else {
    for (let i = count; i >= 1; i--) {
      zIndexes.push(i);
    }
  }
  return zIndexes;
}
