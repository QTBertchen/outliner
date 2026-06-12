import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  UniqueIdentifier,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import OBR, { Item, Math2, Vector2, isShape } from "@owlbear-rodeo/sdk";
import Fuse from "fuse.js";
import { useMemo, useState } from "react";
import { ItemDragOverlay } from "./ItemDragOverlay";
import { ItemList } from "./ItemList";
import {
  GROUP_MEMBER_METADATA_KEY,
  Group,
  Row,
  distributeZIndexes,
  getItemGroupId,
  getRowId,
  getRowZIndex,
  isSelfOrDescendantGroup,
  updateGroups,
} from "./groups";
import { isTextable, toPlainText } from "./helpers";
import { useOwlbearStore } from "./useOwlbearStore";

const VALID_LAYERS = new Set<Item["layer"]>([
  "POINTER",
  "RULER",
  "TEXT",
  "NOTE",
  "ATTACHMENT",
  "CHARACTER",
  "MOUNT",
  "PROP",
  "DRAWING",
  "MAP",
]);

const ALL_LAYERS: Item["layer"][] = [
  "POPOVER",
  "POINTER",
  "GRID",
  "CONTROL",
  "FOG",
  "RULER",
  "TEXT",
  "NOTE",
  "ATTACHMENT",
  "CHARACTER",
  "PROP",
  "DRAWING",
  "MOUNT",
  "MAP",
];

/** The insertion position resolved from a drop */
interface Slot {
  layer: Item["layer"];
  /** Target group to insert into or `null` for the layer root */
  parentId: string | null;
  /** zIndex of the row above the slot, if any */
  upper?: number;
  /** zIndex of the row below the slot, if any */
  lower?: number;
}

export function Items({ search }: { search: string }) {
  const items = useOwlbearStore((state) => state.items);
  const groups = useOwlbearStore((state) => state.groups);
  const role = useOwlbearStore((state) => state.role);
  const selection = useOwlbearStore((state) => state.selection);

  const searching = Boolean(search);

  const fuse = useMemo(() => {
    if (!searching) {
      return;
    }
    const searchItems = items.map((item) => {
      const searchItem = {
        id: item.id,
        name: item.name,
        layer: item.layer,
        type: item.type,
        shapeType: "",
        plainText: "",
        richText: "",
      };

      // Search item text
      if (isTextable(item)) {
        searchItem.plainText = item.text.plainText;
        searchItem.richText = toPlainText(item.text.richText);
      }

      if (isShape(item)) {
        searchItem.shapeType = item.shapeType;
      }

      return searchItem;
    });

    return new Fuse(searchItems, {
      keys: [
        "id",
        "name",
        "layer",
        "type",
        "shapeType",
        "plainText",
        "richText",
      ],
      threshold: 0.25,
    });
  }, [items, searching]);

  const filteredItems = useMemo(() => {
    if (search && fuse) {
      const results = fuse.search(search);
      const ids = new Set(results.map((result) => result.item.id));
      return items.filter((item) => ids.has(item.id));
    }
    return items;
  }, [items, fuse, search]);

  const {
    rowsByLayer,
    flatIdsByLayer,
    rowById,
    parentByRowId,
    layerByRowId,
    sortableIds,
    shownItemIds,
  } = useMemo(() => {
    const groupById = new Map(groups.map((group) => [group.id, group]));

    // Groups are hidden while searching so results show as a flat list
    const useGroups = !searching;

    const isValidLayer = (layer: Item["layer"]) =>
      VALID_LAYERS.has(layer) || (layer === "FOG" && role === "GM");

    // Sort items and split them into their group (or the root of their layer)
    const rootItems: Record<Item["layer"], Item[]> = {
      POPOVER: [],
      POINTER: [],
      GRID: [],
      CONTROL: [],
      FOG: [],
      RULER: [],
      TEXT: [],
      NOTE: [],
      ATTACHMENT: [],
      CHARACTER: [],
      PROP: [],
      DRAWING: [],
      MOUNT: [],
      MAP: [],
    };
    const itemsByGroup = new Map<string, Item[]>();
    const sortedItems = [...filteredItems].sort((a, b) => b.zIndex - a.zIndex);
    for (const item of sortedItems) {
      const hidden = !item.visible && role === "PLAYER";
      if (hidden || !isValidLayer(item.layer)) {
        continue;
      }
      const groupId = useGroups ? getItemGroupId(item) : undefined;
      const group = groupId ? groupById.get(groupId) : undefined;
      if (group && group.layer === item.layer) {
        const members = itemsByGroup.get(group.id);
        if (members) {
          members.push(item);
        } else {
          itemsByGroup.set(group.id, [item]);
        }
      } else {
        rootItems[item.layer].push(item);
      }
    }

    // Split groups into the root of their layer or their parent group
    const rootGroupsByLayer = new Map<Item["layer"], Group[]>();
    const groupsByParent = new Map<string, Group[]>();
    if (useGroups) {
      for (const group of groups) {
        if (group.parentId && groupById.has(group.parentId)) {
          const children = groupsByParent.get(group.parentId);
          if (children) {
            children.push(group);
          } else {
            groupsByParent.set(group.parentId, [group]);
          }
        } else if (isValidLayer(group.layer)) {
          const roots = rootGroupsByLayer.get(group.layer);
          if (roots) {
            roots.push(group);
          } else {
            rootGroupsByLayer.set(group.layer, [group]);
          }
        }
      }
    }

    // Build the row tree for each layer, sorted by descending zIndex
    const buildRows = (
      layer: Item["layer"],
      parentId: string | null,
      visited: Set<string>
    ): Row[] => {
      const childGroups =
        (parentId === null
          ? rootGroupsByLayer.get(layer)
          : groupsByParent.get(parentId)) ?? [];
      const childItems =
        parentId === null
          ? rootItems[layer]
          : itemsByGroup.get(parentId) ?? [];
      const rows: Row[] = [];
      for (const group of childGroups) {
        // Guard against cycles in corrupted metadata
        if (visited.has(group.id)) {
          continue;
        }
        visited.add(group.id);
        rows.push({
          type: "group",
          group,
          children: buildRows(layer, group.id, visited),
        });
      }
      for (const item of childItems) {
        rows.push({ type: "item", item });
      }
      return rows.sort((a, b) => getRowZIndex(b) - getRowZIndex(a));
    };

    const rowsByLayer = {} as Record<Item["layer"], Row[]>;
    const flatIdsByLayer = {} as Record<Item["layer"], string[]>;
    const rowById = new Map<string, Row>();
    const parentByRowId = new Map<string, string | null>();
    const layerByRowId = new Map<string, Item["layer"]>();
    const sortableIds: string[] = [];
    const shownItemIds: string[] = [];

    const visited = new Set<string>();
    for (const layer of ALL_LAYERS) {
      const rows = buildRows(layer, null, visited);
      rowsByLayer[layer] = rows;
      const flatIds: string[] = [];
      const walk = (rows: Row[], parentId: string | null) => {
        for (const row of rows) {
          const id = getRowId(row);
          flatIds.push(id);
          rowById.set(id, row);
          parentByRowId.set(id, parentId);
          layerByRowId.set(id, layer);
          if (row.type === "item") {
            shownItemIds.push(id);
          } else {
            walk(row.children, row.group.id);
          }
        }
      };
      walk(rows, null);
      flatIdsByLayer[layer] = flatIds;
      sortableIds.push(...flatIds);
    }

    return {
      rowsByLayer,
      flatIdsByLayer,
      rowById,
      parentByRowId,
      layerByRowId,
      sortableIds,
      shownItemIds,
    };
  }, [filteredItems, groups, role, searching]);

  async function handleItemSelect(
    item: Item,
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) {
    let newSelection: string[] = [];
    const currentSelection = selection ?? [];
    const { id } = item;
    if (event.metaKey || event.ctrlKey) {
      // Make a multi selection
      if (currentSelection.includes(id)) {
        newSelection = currentSelection.filter((c) => c !== id);
      } else {
        newSelection = [...currentSelection, id];
      }
    } else if (event.shiftKey) {
      // Make a range selection
      if (currentSelection.length > 0) {
        const currentIndex = shownItemIds.indexOf(id);
        const lastIndex = shownItemIds.indexOf(
          currentSelection[currentSelection.length - 1]
        );
        const idsToAdd: string[] = [];
        const idsToRemove: string[] = [];
        const direction = currentIndex > lastIndex ? 1 : -1;
        for (
          let i = lastIndex + direction;
          direction < 0 ? i >= currentIndex : i <= currentIndex;
          i += direction
        ) {
          const localId = shownItemIds[i];
          if (currentSelection.includes(localId)) {
            idsToRemove.push(localId);
          } else {
            idsToAdd.push(localId);
          }
        }
        newSelection = [...currentSelection, ...idsToAdd].filter(
          (id) => !idsToRemove.includes(id)
        );
      } else {
        newSelection = [id];
      }
    } else {
      // Single selection
      newSelection = [id];
    }

    if (newSelection.length === 0) {
      await OBR.player.deselect();
    } else {
      await OBR.player.select(newSelection);
    }
  }

  async function handleItemFocus(item: Item) {
    const focusedIds = [...new Set([...(selection ?? []), item.id])];

    // Convert the center of the selected item to screen-space
    const bounds = await OBR.scene.items.getItemBounds(focusedIds);
    const boundsAbsoluteCenter = await OBR.viewport.transformPoint(
      bounds.center
    );

    // Get the center of the viewport in screen-space
    const viewportWidth = await OBR.viewport.getWidth();
    const viewportHeight = await OBR.viewport.getHeight();
    const viewportCenter: Vector2 = {
      x: viewportWidth / 2,
      y: viewportHeight / 2,
    };

    // Offset the item center by the viewport center
    const absoluteCenter = Math2.subtract(boundsAbsoluteCenter, viewportCenter);

    // Convert the center to world-space
    const relativeCenter = await OBR.viewport.inverseTransformPoint(
      absoluteCenter
    );

    // Invert and scale the world-space position to match a viewport position offset
    const viewportScale = await OBR.viewport.getScale();
    const viewportPosition = Math2.multiply(relativeCenter, -viewportScale);

    await OBR.viewport.animateTo({
      scale: viewportScale,
      position: viewportPosition,
    });
  }

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 3 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 5 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);

  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  const [dragId, setDragId] = useState<UniqueIdentifier | null>(null);

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;

    if (typeof active.id !== "string") {
      return;
    }

    if (rowById.get(active.id)?.type === "group") {
      // Groups are not OBR items so they don't affect the selection
      if (role !== "GM") {
        return;
      }
    } else if (!selection || !selection.includes(active.id)) {
      OBR.player.select([active.id]);
    }

    setDragId(active.id);
  }

  /**
   * Resolve the insertion position for a drop using insert-after-row
   * semantics: dropping over a group header inserts at the top of that
   * group, dropping over an item inserts after it within its group.
   */
  function getSlot(overId: string): Slot | undefined {
    if (overId.startsWith("START_")) {
      const layer = overId.slice(6) as Item["layer"];
      const first = rowsByLayer[layer][0];
      return {
        layer,
        parentId: null,
        lower: first ? getRowZIndex(first) : undefined,
      };
    }

    const overRow = rowById.get(overId);
    const layer = layerByRowId.get(overId);
    if (!overRow || !layer) {
      return undefined;
    }

    const parentId =
      overRow.type === "group"
        ? overRow.group.id
        : parentByRowId.get(overId) ?? null;

    const flatIds = flatIdsByLayer[layer];
    const nextId = flatIds[flatIds.indexOf(overId) + 1];
    const nextRow = nextId ? rowById.get(nextId) : undefined;

    return {
      layer,
      parentId,
      upper: getRowZIndex(overRow),
      lower: nextRow ? getRowZIndex(nextRow) : undefined,
    };
  }

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over?.id;
    if (typeof overId === "string" && typeof dragId === "string") {
      const slot = getSlot(overId);
      const dragRow = rowById.get(dragId);
      if (slot) {
        if (dragRow?.type === "group") {
          // Prevent dropping a group into itself or its descendants
          const cycle =
            slot.parentId !== null &&
            isSelfOrDescendantGroup(groups, dragRow.group.id, slot.parentId);
          if (role === "GM" && !cycle) {
            moveGroupTo(dragRow, slot);
          }
        } else {
          moveSelectionTo(slot);
        }
      }
    }

    setDragId(null);
  }

  // Move the current selection into the slot, updating zIndex,
  // layer and group membership together
  async function moveSelectionTo(slot: Slot) {
    if (!selection) {
      return;
    }

    const sorted = [...selection].sort(
      (a, b) => sortableIds.indexOf(a) - sortableIds.indexOf(b)
    );
    const zIndexes = distributeZIndexes(slot.upper, slot.lower, sorted.length);
    await OBR.scene.items.updateItems(sorted, (items: Item[]) => {
      items.forEach((item, index) => {
        item.zIndex = zIndexes[index];
        item.layer = slot.layer;
        if (slot.parentId) {
          item.metadata[GROUP_MEMBER_METADATA_KEY] = slot.parentId;
        } else {
          delete item.metadata[GROUP_MEMBER_METADATA_KEY];
        }
      });
    });
  }

  // Move a group and its entire subtree into the slot, rewriting the
  // zIndexes of all contained rows so canvas order matches the outline
  async function moveGroupTo(row: Row & { type: "group" }, slot: Slot) {
    const subtree: Row[] = [];
    const collect = (current: Row) => {
      subtree.push(current);
      if (current.type === "group") {
        current.children.forEach(collect);
      }
    };
    collect(row);

    const zIndexes = distributeZIndexes(slot.upper, slot.lower, subtree.length);
    const groupZIndexes = new Map<string, number>();
    const itemZIndexes = new Map<string, number>();
    subtree.forEach((current, index) => {
      if (current.type === "group") {
        groupZIndexes.set(current.group.id, zIndexes[index]);
      } else {
        itemZIndexes.set(current.item.id, zIndexes[index]);
      }
    });

    await updateGroups((groups) =>
      groups.map((group) => {
        const zIndex = groupZIndexes.get(group.id);
        if (zIndex === undefined) {
          return group;
        }
        if (group.id === row.group.id) {
          return { ...group, zIndex, layer: slot.layer, parentId: slot.parentId };
        }
        return { ...group, zIndex, layer: slot.layer };
      })
    );

    if (itemZIndexes.size > 0) {
      await OBR.scene.items.updateItems([...itemZIndexes.keys()], (items) => {
        for (const item of items) {
          item.zIndex = itemZIndexes.get(item.id) ?? item.zIndex;
          item.layer = slot.layer;
        }
      });
    }
  }

  function handleDragCancel() {
    setDragId(null);
  }

  const shownLayers = useMemo<Item["layer"][]>(() => {
    if (!searching) {
      const layers = [...VALID_LAYERS];
      if (role == "GM") {
        return [layers[0], "FOG", ...layers.slice(1)];
      } else {
        return layers;
      }
    } else {
      // When searching only show layers with results
      return ALL_LAYERS.filter((layer) => rowsByLayer[layer].length > 0);
    }
  }, [searching, rowsByLayer, role]);

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      collisionDetection={closestCenter}
      sensors={sensors}
    >
      <SortableContext
        items={sortableIds}
        strategy={verticalListSortingStrategy}
      >
        {shownLayers.map((layer) => (
          <ItemList
            key={layer}
            rows={rowsByLayer[layer]}
            layer={layer as Item["layer"]}
            onItemSelect={handleItemSelect}
            onItemFocus={handleItemFocus}
          />
        ))}
        <ItemDragOverlay dragId={dragId} />
      </SortableContext>
    </DndContext>
  );
}
