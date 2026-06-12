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

  setSceneReady: (ready: boolean) => void;
  setItems: (items: Item[]) => void;
  setGroups: (groups: Group[]) => void;
  setFogFilled: (fogFilled: boolean) => void;
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

  setSceneReady: (sceneReady) => set((state) => ({ ...state, sceneReady })),
  setItems: (items) => set((state) => ({ ...state, items })),
  setGroups: (groups) => set((state) => ({ ...state, groups })),
  setFogFilled: (fogFilled) => set((state) => ({ ...state, fogFilled })),
  setRole: (role) => set((state) => ({ ...state, role })),
  setSelection: (selection) => set((state) => ({ ...state, selection })),
  setPermissions: (permissions) => set((state) => ({ ...state, permissions })),
}));
