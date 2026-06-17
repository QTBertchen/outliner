import CreateNewFolderIcon from "@mui/icons-material/esm/CreateNewFolderRounded";
import ExpandLess from "@mui/icons-material/esm/ExpandLessRounded";
import ExpandMore from "@mui/icons-material/esm/ExpandMoreRounded";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import { Item } from "@owlbear-rodeo/sdk";
import { useState } from "react";
import { RowList } from "./GroupListItem";
import { LayerIcon } from "./LayerIcon";
import { SortableItem } from "./SortableItem";
import { Row, createGroup, getRowZIndex } from "./groups";
import { capitalize } from "./helpers";
import { useOwlbearStore } from "./useOwlbearStore";

export function ItemList({
  layer,
  rows,
  onItemSelect,
  onItemFocus,
}: {
  layer: Item["layer"];
  rows: Row[];
  onItemSelect: (
    item: Item,
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => void;
  onItemFocus: (
    item: Item,
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => void;
}) {
  const role = useOwlbearStore((state) => state.role);
  const [open, setOpen] = useState(false);

  function handleLayerToggle() {
    setOpen(!open);
  }

  function handleAddGroup(event: React.MouseEvent) {
    event.stopPropagation();
    // Place the new group at the top of the layer
    const topZIndex = rows.length > 0 ? getRowZIndex(rows[0]) + 1 : 1;
    createGroup(layer, topZIndex);
    setOpen(true);
  }

  const layerName = `${capitalize(layer)}${
    layer !== "FOG" && layer !== "TEXT" ? "s" : ""
  }`;

  return (
    <>
      <ListItemButton dense onClick={handleLayerToggle} divider>
        <ListItemIcon
          sx={{
            color: "text.secondary",
            minWidth: "28px",
            "& svg": { fontSize: "1.25rem" },
          }}
        >
          <LayerIcon layer={layer} />
        </ListItemIcon>
        <ListItemText primary={layerName} />
        {role === "GM" && (
          <Tooltip title="Add group" disableInteractive>
            <IconButton
              size="small"
              sx={{ color: "text.secondary", mr: 0.5 }}
              onClick={handleAddGroup}
            >
              <CreateNewFolderIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {open ? <ExpandLess /> : <ExpandMore />}
      </ListItemButton>
      <Collapse in={open} unmountOnExit>
        <List component="div" dense>
          {/* A pseudo element that shows a sort indicator for the start of the list */}
          <SortableItem itemId={`START_${layer}`} />
          <RowList
            rows={rows}
            onItemSelect={onItemSelect}
            onItemFocus={onItemFocus}
          />
        </List>
      </Collapse>
    </>
  );
}
