"use server";

import { redirect } from "next/navigation";
import { createSession, deleteSession } from "@/lib/session";

export type LoginState = {
  error?: string;
  email?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function authenticate(
  email: string,
  password: string
): Promise<{ token: string; role: string } | null> {
  const apiUrl = process.env.API_URL;

  if (!apiUrl) {
    throw new Error("Falta la variable de entorno API_URL.");
  }

  const res = await fetch(
    new URL("auth/login", apiUrl.replace(/\/?$/, "/")),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    }
  );

  if (res.status === 401 || res.status === 403) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`auth/login respondió ${res.status}`);
  }

  const data = await res.json();

  const token: string | undefined = data.accessToken;
  const role: string | undefined = data.user?.role;

  if (!token || !role) {
    throw new Error("La respuesta de auth/login no incluye el token o el rol.");
  }

  return { token, role };
}

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu correo y contraseña.", email };
  }

  if (!EMAIL_REGEX.test(email)) {
    return { error: "Ingresa un correo válido.", email };
  }

  let resultado: { token: string; role: string } | null;

  try {
    resultado = await authenticate(email, password);
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    return {
      error: "No se pudo iniciar sesión. Intenta más tarde.",
      email,
    };
  }

  if (!resultado) {
    return { error: "Correo o contraseña incorrectos.", email };
  }

  await createSession(resultado.token);

  if (resultado.role === "COCINA") {
    redirect("/cocina");
  }

  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
