import { Item, Permission, Player } from "@owlbear-rodeo/sdk";
import { create } from "zustand";
import { Group } from "./groups";

interface OwlbearState {
  sceneReady: boolean;
  items: Item[];
  groups: Group[];
  role: Player["role"];
  selection: Player["selection"];
  permissions: Permission[];
  fogFilled: boolean;
  gridDpi: number;
  actionOpen: boolean;

  setSceneReady: (ready: boolean) => void;
  setActionOpen: (actionOpen: boolean) => void;
  setItems: (items: Item[]) => void;
  setGroups: (groups: Group[]) => void;
  setFogFilled: (fogFilled: boolean) => void;
  setGridDpi: (gridDpi: number) => void;
  setRole: (role: Player["role"]) => void;
  setSelection: (selection: Player["selection"]) => void;
  setPermissions: (permissions: Permission[]) => void;
}

export const useOwlbearStore = create<OwlbearState>()((set) => ({
  items: [],
  groups: [],
  role: "PLAYER",
  sceneReady: false,
  selection: undefined,
  permissions: [],
  fogFilled: false,
  gridDpi: 150,
  actionOpen: false,

  setSceneReady: (sceneReady) => set((state) => ({ ...state, sceneReady })),
  setActionOpen: (actionOpen) => set((state) => ({ ...state, actionOpen })),
  setItems: (items) => set((state) => ({ ...state, items })),
  setGroups: (groups) => set((state) => ({ ...state, groups })),
  setFogFilled: (fogFilled) => set((state) => ({ ...state, fogFilled })),
  setGridDpi: (gridDpi) => set((state) => ({ ...state, gridDpi })),
  setRole: (role) => set((state) => ({ ...state, role })),
  setSelection: (selection) => set((state) => ({ ...state, selection })),
  setPermissions: (permissions) => set((state) => ({ ...state, permissions })),
}));
