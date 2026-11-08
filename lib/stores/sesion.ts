"use client";

import { create } from "zustand";

// Estado global de la sesión (decisión técnica del documento: Zustand):
// sesión, rol y sucursal del usuario, y el contador de avisos No leída (H26).
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

export type SucursalSesion = {
  id: string;
  name: string;
};

type EstadoSesion = {
  usuario: UsuarioSesion | null;
  sucursal: SucursalSesion | null;
  cargando: boolean;
  cargarUsuario: () => Promise<UsuarioSesion | null>;
  // La sucursal la decide el backend a partir de la sesión;
  // el frontend solo la guarda para mostrarla.
  guardarSucursal: (sucursal: SucursalSesion) => void;
  // H26: contador de avisos No leída, usado por la campana del encabezado.
  noLeidas: number;
  cargarNoLeidas: () => Promise<void>;
};

export const useSesion = create<EstadoSesion>((set, get) => ({
  usuario: null,
  sucursal: null,
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

  guardarSucursal: (sucursal) => set({ sucursal }),

  noLeidas: 0,

  cargarNoLeidas: async () => {
    try {
      const respuesta = await fetch(
        "/api/notificaciones/notifications/unread-count",
        { cache: "no-store" }
      );
      if (!respuesta.ok) return;
      const datos: { count: number } = await respuesta.json();
      set({ noLeidas: datos.count });
    } catch {
      // El contador se vuelve a intentar en la siguiente consulta.
    }
  },
}));
