import { useOwlbearStore } from "./useOwlbearStore";
import { createPortal } from "react-dom";
import { DragOverlay, UniqueIdentifier } from "@dnd-kit/core";
import { ItemListItem } from "./ItemListItem";
import { GroupListItem } from "./GroupListItem";
import Badge from "@mui/material/Badge";
import { memo } from "react";

export const ItemDragOverlay = memo(function ({
  dragId,
}: {
  dragId: UniqueIdentifier | null;
}) {
  const items = useOwlbearStore((state) => state.items);
  const groups = useOwlbearStore((state) => state.groups);
  const selection = useOwlbearStore((state) => state.selection);

  function renderDragOverlays() {
    if (!dragId || typeof dragId !== "string") {
      return null;
    }

    const group = groups.find((group) => group.id === dragId);
    if (group) {
      return (
        <div
          style={{
            zIndex: 10000,
            position: "absolute",
          }}
        >
          <DragOverlay dropAnimation={null}>
            <GroupListItem group={group} rows={[]} dragging />
          </DragOverlay>
        </div>
      );
    }

    if (!selection) {
      return null;
    }
    const itemIds = items.map((item) => item.id);
    let selectedIndices = selection.map((id) => itemIds.indexOf(id));
    const activeIndex = itemIds.indexOf(dragId);
    // Sort so the dragging item is the first element
    selectedIndices = selectedIndices.sort((a, b) =>
      a === activeIndex ? -1 : b === activeIndex ? 1 : 0
    );

    // Limit shown assets to 5
    selectedIndices = selectedIndices.slice(0, 5);

    // Push each asset down and to the right
    let coords = selectedIndices.map((_, index) => ({
      x: 5 * index,
      y: 5 * index,
    }));

    // Reverse so the first element is rendered on top
    selectedIndices = selectedIndices.reverse();
    coords = coords.reverse();

    const selectedItems = selectedIndices.map((index) => items[index]);

    const overlays = selectedItems.map((item, index) => (
      <DragOverlay dropAnimation={null} key={item.id}>
        <div
          style={{
            transform: `translate(${coords[index].x}px, ${coords[index].y}px)`,
          }}
        >
          <ItemListItem item={item} dragging />
          {index === selectedIndices.length - 1 && selection.length > 1 && (
            <Badge
              sx={{
                position: "absolute",
                top: 0,
                right: 0,
                transform: "translate(-4px, 4px)",
              }}
              color="secondary"
              badgeContent={selection.length}
            />
          )}
        </div>
      </DragOverlay>
    ));

    return (
      <div
        style={{
          zIndex: 10000,
          position: "absolute",
        }}
      >
        {overlays}
      </div>
    );
  }

  return createPortal(dragId && renderDragOverlays(), document.body);
});
