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

  setSceneReady: (ready: boolean) => void;
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

  setSceneReady: (sceneReady) => set((state) => ({ ...state, sceneReady })),
  setItems: (items) => set((state) => ({ ...state, items })),
  setGroups: (groups) => set((state) => ({ ...state, groups })),
  setFogFilled: (fogFilled) => set((state) => ({ ...state, fogFilled })),
  setGridDpi: (gridDpi) => set((state) => ({ ...state, gridDpi })),
  setRole: (role) => set((state) => ({ ...state, role })),
  setSelection: (selection) => set((state) => ({ ...state, selection })),
  setPermissions: (permissions) => set((state) => ({ ...state, permissions })),
}));
