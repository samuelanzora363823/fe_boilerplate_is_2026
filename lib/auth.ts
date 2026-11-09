
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

const API_URL = process.env.API_URL;

type Usuario = {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
};

export async function obtenerUsuario(): Promise<Usuario> {
  const token = await getSession();

  if (!token) {
    redirect("/login");
  }

  if (!API_URL) {
    throw new Error("API_URL no está configurada.");
  }

  const response = await fetch(
    `${API_URL.replace(/\/+$/, "")}/auth/me`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (response.status === 401 || response.status === 403) {
    redirect("/login");
  }

  if (!response.ok) {
    throw new Error("No se pudo verificar el usuario.");
  }

  return response.json();
}

export async function verificarRol(rolPermitido: string) {
  const usuario = await obtenerUsuario();

  if (usuario.role !== rolPermitido) {
    redirect("/");
  }

  return usuario;
}
