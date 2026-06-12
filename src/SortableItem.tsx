import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import Box from "@mui/material/Box";

export function SortableItem({
  itemId,
  children,
  disableDrag,
}: {
  itemId: string;
  children?: React.ReactNode;
  disableDrag?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging, isOver } = useSortable(
    {
      id: itemId,
      // Keep the row as a drop target but prevent it from being dragged
      disabled: { draggable: disableDrag ?? false, droppable: false },
    }
  );

  return (
    <Box
      ref={setNodeRef}
      sx={{
        position: "relative",
        "::after":
          isOver && !isDragging
            ? {
                content: "''",
                position: "absolute",
                bottom: 0,
                left: "16px",
                right: "16px",
                height: "2px",
                backgroundColor: "primary.main",
              }
            : undefined,
        outline: "none",
      }}
      {...attributes}
      {...listeners}
    >
      {children}
    </Box>
  );
}
