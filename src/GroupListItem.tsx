import DeleteIcon from "@mui/icons-material/esm/DeleteRounded";
import ExpandLess from "@mui/icons-material/esm/ExpandLessRounded";
import ExpandMore from "@mui/icons-material/esm/ExpandMoreRounded";
import FolderOpenIcon from "@mui/icons-material/esm/FolderOpenRounded";
import FolderIcon from "@mui/icons-material/esm/FolderRounded";
import UnlockIcon from "@mui/icons-material/esm/LockOpenRounded";
import LockedIcon from "@mui/icons-material/esm/LockRounded";
import SelectAllIcon from "@mui/icons-material/esm/SelectAllRounded";
import HiddenIcon from "@mui/icons-material/esm/VisibilityOffRounded";
import VisibleIcon from "@mui/icons-material/esm/VisibilityRounded";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import useTheme from "@mui/material/styles/useTheme";
import OBR, { Item } from "@owlbear-rodeo/sdk";
import { useMemo, useState } from "react";
import { ItemListItem } from "./ItemListItem";
import { SortableItem } from "./SortableItem";
import { Group, Row, deleteGroup, getRowItems, renameGroup } from "./groups";
import { itemHasPermission } from "./hasPermission";
import FogCutOffIcon from "./icons/other/FogCutOff";
import FogCutOnIcon from "./icons/other/FogCutOn";
import { useOwlbearStore } from "./useOwlbearStore";

type ItemMouseHandler = (
  item: Item,
  event: React.MouseEvent<HTMLDivElement, MouseEvent>
) => void;

/** Render a list of outline rows (items and nested groups) */
export function RowList({
  rows,
  onItemSelect,
  onItemFocus,
}: {
  rows: Row[];
  onItemSelect?: ItemMouseHandler;
  onItemFocus?: ItemMouseHandler;
}) {
  const role = useOwlbearStore((state) => state.role);

  return (
    <>
      {rows.map((row) =>
        row.type === "group" ? (
          <SortableItem
            key={row.group.id}
            itemId={row.group.id}
            disableDrag={role !== "GM"}
          >
            <GroupListItem
              group={row.group}
              rows={row.children}
              onItemSelect={onItemSelect}
              onItemFocus={onItemFocus}
            />
          </SortableItem>
        ) : (
          <SortableItem key={row.item.id} itemId={row.item.id}>
            <ItemListItem
              item={row.item}
              onClick={onItemSelect && ((e) => onItemSelect(row.item, e))}
              onDoubleClick={onItemFocus && ((e) => onItemFocus(row.item, e))}
            />
          </SortableItem>
        )
      )}
    </>
  );
}

export function GroupListItem({
  group,
  rows,
  onItemSelect,
  onItemFocus,
  dragging,
}: {
  group: Group;
  rows: Row[];
  onItemSelect?: ItemMouseHandler;
  onItemFocus?: ItemMouseHandler;
  dragging?: boolean;
}) {
  const role = useOwlbearStore((state) => state.role);
  const permissions = useOwlbearStore((state) => state.permissions);
  const selection = useOwlbearStore((state) => state.selection);
  const theme = useTheme();

  const [open, setOpen] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);

  // All items inside this group, including nested sub groups
  const descendantItems = useMemo(() => getRowItems(rows), [rows]);

  const allLocked =
    descendantItems.length > 0 && descendantItems.every((item) => item.locked);
  const anyVisible = descendantItems.some((item) => item.visible);

  const canUpdateAll = useMemo(
    () =>
      descendantItems.length > 0 &&
      descendantItems.every((item) =>
        itemHasPermission(item, "UPDATE", permissions, role, OBR.player.id)
      ),
    [descendantItems, permissions, role]
  );

  const showLocked = (allLocked || hovering) && canUpdateAll;
  const showVisible =
    (!anyVisible || hovering || showLocked) &&
    role === "GM" &&
    descendantItems.length > 0;
  const showSelect = hovering && descendantItems.length > 0;
  const showDelete = role === "GM" && hovering;
  const showActions =
    (showLocked || showVisible || showSelect || showDelete) && !dragging;
  const actionCount =
    (showLocked ? 1 : 0) +
    (showVisible ? 1 : 0) +
    (showSelect ? 1 : 0) +
    (showDelete ? 1 : 0);

  function handleLockClick(event: React.MouseEvent) {
    event.stopPropagation();
    OBR.scene.items.updateItems(descendantItems, (items) => {
      for (const item of items) {
        item.locked = !allLocked;
      }
    });
  }

  function handleVisibleClick(event: React.MouseEvent) {
    event.stopPropagation();
    OBR.scene.items.updateItems(descendantItems, (items) => {
      for (const item of items) {
        item.visible = !anyVisible;
      }
    });
  }

  function handleSelectClick(event: React.MouseEvent) {
    event.stopPropagation();
    const ids = descendantItems.map((item) => item.id);
    if (event.metaKey || event.ctrlKey) {
      // Add the group's items to the current selection
      OBR.player.select([...new Set([...(selection ?? []), ...ids])]);
    } else {
      OBR.player.select(ids);
    }
  }

  function startRename() {
    setName(group.name);
    setEditing(true);
  }

  function commitRename() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== group.name) {
      renameGroup(group.id, trimmed);
    }
    setEditing(false);
  }

  return (
    <>
      <ListItem
        disablePadding
        secondaryAction={
          showActions ? (
            <Stack direction="row" sx={{ opacity: !hovering ? 0.5 : 1 }}>
              {showLocked && (
                <Tooltip title={allLocked ? "Unlock" : "Lock"} disableInteractive>
                  <IconButton size="small" edge="end" onClick={handleLockClick}>
                    {allLocked ? (
                      <LockedIcon fontSize="small" />
                    ) : (
                      <UnlockIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              )}
              {showVisible && (
                <Tooltip
                  title={
                    anyVisible
                      ? group.layer === "FOG"
                        ? "Cut"
                        : "Hide"
                      : group.layer === "FOG"
                      ? "Uncut"
                      : "Show"
                  }
                  disableInteractive
                >
                  <IconButton
                    size="small"
                    edge="end"
                    onClick={handleVisibleClick}
                  >
                    {anyVisible ? (
                      group.layer === "FOG" ? (
                        <FogCutOffIcon fontSize="small" />
                      ) : (
                        <VisibleIcon fontSize="small" />
                      )
                    ) : group.layer === "FOG" ? (
                      <FogCutOnIcon fontSize="small" />
                    ) : (
                      <HiddenIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              )}
              {showSelect && (
                <Tooltip title="Select items" disableInteractive>
                  <IconButton
                    size="small"
                    edge="end"
                    onClick={handleSelectClick}
                  >
                    <SelectAllIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {showDelete && (
                <Tooltip title="Ungroup" disableInteractive>
                  <IconButton
                    size="small"
                    edge="end"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteGroup(group.id);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          ) : undefined
        }
        onPointerOver={(e) => {
          if (e.pointerType === "mouse") {
            setHovering(true);
          }
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") {
            setHovering(false);
          }
        }}
        sx={{
          ".MuiListItemButton-root": {
            pr: showActions ? `${8 + actionCount * 28}px` : undefined,
          },
        }}
      >
        <ListItemButton
          sx={{
            margin: "4px 8px",
            borderRadius: "12px",
            backgroundColor: dragging
              ? `${theme.palette.primary.main} !important`
              : undefined,
            boxShadow: dragging ? theme.shadows[5] : undefined,
            color: dragging
              ? `${theme.palette.primary.contrastText} !important`
              : undefined,
            cursor: dragging ? "grabbing" : undefined,
          }}
          onClick={() => {
            if (!editing) {
              setOpen(!open);
            }
          }}
          onDoubleClick={() => {
            if (role === "GM" && !editing) {
              startRename();
            }
          }}
          dense
        >
          <ListItemIcon
            sx={{
              opacity: "0.75",
              minWidth: "28px",
              "& svg": { fontSize: "1.25rem" },
              color: "inherit",
            }}
          >
            {open && !dragging ? <FolderOpenIcon /> : <FolderIcon />}
          </ListItemIcon>
          {editing ? (
            <TextField
              variant="standard"
              size="small"
              fullWidth
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                // Don't trigger drag/global shortcuts while typing
                e.stopPropagation();
                if (e.key === "Enter") {
                  commitRename();
                } else if (e.key === "Escape") {
                  setEditing(false);
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <ListItemText
              primary={group.name}
              primaryTypographyProps={{ noWrap: true }}
            />
          )}
          {!dragging && !editing && (open ? <ExpandLess /> : <ExpandMore />)}
        </ListItemButton>
      </ListItem>
      {!dragging && (
        <Collapse in={open} unmountOnExit>
          <List component="div" dense disablePadding sx={{ pl: 2 }}>
            <RowList
              rows={rows}
              onItemSelect={onItemSelect}
              onItemFocus={onItemFocus}
            />
          </List>
        </Collapse>
      )}
    </>
  );
}
