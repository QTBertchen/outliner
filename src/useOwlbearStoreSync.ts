import OBR, { Player } from "@owlbear-rodeo/sdk";
import { useOwlbearStore } from "./useOwlbearStore";
import { useEffect } from "react";
import { getGroups } from "./groups";

// Sync OBR with the apps Zustand store
export function useOwlbearStoreSync() {
  const setSceneReady = useOwlbearStore((state) => state.setSceneReady);
  useEffect(() => {
    OBR.scene.isReady().then(setSceneReady);
    return OBR.scene.onReadyChange(setSceneReady);
  }, []);

  // Only sync scene data while the action popover is open so no
  // work happens in the background when the outliner is closed
  const setActionOpen = useOwlbearStore((state) => state.setActionOpen);
  useEffect(() => {
    OBR.action.isOpen().then(setActionOpen);
    return OBR.action.onOpenChange(setActionOpen);
  }, [setActionOpen]);

  const sceneReady = useOwlbearStore((state) => state.sceneReady);
  const actionOpen = useOwlbearStore((state) => state.actionOpen);
  const syncing = sceneReady && actionOpen;

  const setItems = useOwlbearStore((state) => state.setItems);
  useEffect(() => {
    if (syncing) {
      OBR.scene.items.getItems().then(setItems);
      return OBR.scene.items.onChange(setItems);
    } else {
      setItems([]);
    }
  }, [syncing]);

  const setGroups = useOwlbearStore((state) => state.setGroups);
  useEffect(() => {
    if (syncing) {
      OBR.scene.getMetadata().then((metadata) => setGroups(getGroups(metadata)));
      return OBR.scene.onMetadataChange((metadata) =>
        setGroups(getGroups(metadata))
      );
    } else {
      setGroups([]);
    }
  }, [syncing, setGroups]);

  const setFogFilled = useOwlbearStore((state) => state.setFogFilled);
  useEffect(() => {
    if (syncing) {
      OBR.scene.fog.getFilled().then(setFogFilled);
      return OBR.scene.fog.onChange((fog) => setFogFilled(fog.filled));
    } else {
      setFogFilled(false);
    }
  }, [syncing, setFogFilled]);

  const setGridDpi = useOwlbearStore((state) => state.setGridDpi);
  useEffect(() => {
    if (syncing) {
      OBR.scene.grid.getDpi().then(setGridDpi);
      return OBR.scene.grid.onChange((grid) => setGridDpi(grid.dpi));
    }
  }, [syncing, setGridDpi]);

  const setRole = useOwlbearStore((state) => state.setRole);
  const setSelection = useOwlbearStore((state) => state.setSelection);
  useEffect(() => {
    if (actionOpen) {
      const handlePlayerChange = (player: Player) => {
        setRole(player.role);
        setSelection(player.selection);
      };
      OBR.player.getRole().then(setRole);
      OBR.player.getSelection().then(setSelection);
      return OBR.player.onChange(handlePlayerChange);
    }
  }, [actionOpen]);

  const setPermissions = useOwlbearStore((state) => state.setPermissions);
  useEffect(() => {
    OBR.room.getPermissions().then(setPermissions);
    return OBR.room.onPermissionsChange(setPermissions);
  }, []);
}
