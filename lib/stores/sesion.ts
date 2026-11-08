"use client";

import { create } from "zustand";

// Estado global de la sesión (decisión técnica del documento: Zustand).
// La sucursal no viaja aquí: el backend la toma siempre de la sesión.
export type RolUsuario =
  | "GERENTE"
  | "MESERO"
  | "COCINA"
  | "CLIENTE"
  | "GERENTE_GENERAL";

export type UsuarioSesion = {
  id: string;
  email: string;
  role: RolUsuario;
};

type EstadoSesion = {
  usuario: UsuarioSesion | null;
  cargando: boolean;
  cargarUsuario: () => Promise<UsuarioSesion | null>;
};

export const useSesion = create<EstadoSesion>((set, get) => ({
  usuario: null,
  cargando: false,

  cargarUsuario: async () => {
    const actual = get().usuario;
    if (actual) return actual;

    set({ cargando: true });

    try {
      const respuesta = await fetch("/api/auth/me", { cache: "no-store" });
      const usuario: UsuarioSesion | null = respuesta.ok
        ? await respuesta.json()
        : null;
      set({ usuario });
      return usuario;
    } catch {
      return null;
    } finally {
      set({ cargando: false });
    }
  },
}));
