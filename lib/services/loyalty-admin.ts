// H22: configuración del programa de lealtad (Gerente).
// Las llamadas pasan por el proxy /api/gerente/loyalty/..., que reenvía a
// /loyalty/admin/... del backend con el token de la sesión.

export type TipoDescuento = "PERCENTAGE" | "FIXED";

export type ReglaLealtad = {
  pointsPerDollar: number;
  // null mientras rige la tasa por defecto (nadie ha guardado una regla).
  updatedAt: string | null;
};

export type CambioRegla = {
  id: string;
  previousPointsPerDollar: number;
  newPointsPerDollar: number;
  changedAt: string;
  changedBy: { id: string; email: string };
};

export type BeneficioAdmin = {
  id: string;
  name: string;
  pointsRequired: number;
  discountType: TipoDescuento;
  discountValue: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: { id: string; email: string } | null;
};

export type DatosBeneficio = {
  name: string;
  pointsRequired: number;
  discountType: TipoDescuento;
  discountValue: number;
};

// Error con el código HTTP, para distinguir sesión vencida (401),
// falta de permiso (403), validación (400), inexistente (404) y duplicado (409).
export class ErrorLealtadAdmin extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ErrorLealtadAdmin";
  }
}

function mensajeDe(datos: unknown, status: number): string {
  if (datos && typeof datos === "object" && "message" in datos) {
    const message = (datos as { message: unknown }).message;
    if (Array.isArray(message) && message.length > 0) {
      return message.map(String).join(" ");
    }
    if (typeof message === "string" && message.trim()) return message;
  }
  return `No se pudo completar la operación (HTTP ${status}).`;
}

async function solicitar<T>(
  ruta: string,
  opciones: { method?: string; body?: unknown } = {},
): Promise<T> {
  const respuesta = await fetch(`/api/gerente/loyalty/${ruta}`, {
    method: opciones.method ?? "GET",
    headers:
      opciones.body === undefined
        ? undefined
        : { "Content-Type": "application/json" },
    body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body),
    credentials: "same-origin",
    cache: "no-store",
  });

  let datos: unknown = null;
  const texto = await respuesta.text();
  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = null;
    }
  }

  if (!respuesta.ok) {
    throw new ErrorLealtadAdmin(mensajeDe(datos, respuesta.status), respuesta.status);
  }
  return datos as T;
}

export const obtenerRegla = () => solicitar<ReglaLealtad>("rules");

export const guardarRegla = (pointsPerDollar: number) =>
  solicitar<ReglaLealtad>("rules", { method: "PUT", body: { pointsPerDollar } });

export const obtenerHistorialRegla = () =>
  solicitar<{ items: CambioRegla[] }>("rules/history");

export const listarBeneficiosAdmin = () =>
  solicitar<{ items: BeneficioAdmin[] }>("benefits");

export const crearBeneficio = (datos: DatosBeneficio) =>
  solicitar<BeneficioAdmin>("benefits", { method: "POST", body: datos });

export const editarBeneficio = (id: string, datos: DatosBeneficio) =>
  solicitar<BeneficioAdmin>(`benefits/${id}`, { method: "PUT", body: datos });

export const cambiarEstadoBeneficio = (id: string, active: boolean) =>
  solicitar<BeneficioAdmin>(`benefits/${id}/status`, {
    method: "PATCH",
    body: { active },
  });

// ---- Validaciones compartidas por el formulario (las mismas del backend) ----

export const NOMBRE_MAX = 80;
const DECIMAL_2 = /^\d+(\.\d{1,2})?$/;
const MAX_DECIMAL = 99_999_999.99;
const MAX_PUNTOS = 2_147_483_647;

export function validarTasa(texto: string): string | null {
  const valor = texto.trim();
  if (!valor) return "Ingresa los puntos por dólar.";
  if (!DECIMAL_2.test(valor)) {
    return "Usa un número positivo con máximo 2 decimales.";
  }
  const numero = Number(valor);
  if (numero <= 0) return "Los puntos por dólar deben ser mayores que cero.";
  if (numero > MAX_DECIMAL) return "El valor supera el máximo permitido.";
  return null;
}

export type ErroresBeneficio = Partial<
  Record<"name" | "pointsRequired" | "discountValue", string>
>;

export function validarBeneficio(campos: {
  name: string;
  pointsRequired: string;
  discountType: TipoDescuento;
  discountValue: string;
}): ErroresBeneficio {
  const errores: ErroresBeneficio = {};
  const nombre = campos.name.trim();
  if (!nombre) errores.name = "El nombre es obligatorio.";
  else if (nombre.length > NOMBRE_MAX) {
    errores.name = `El nombre debe tener entre 1 y ${NOMBRE_MAX} caracteres.`;
  }

  const puntos = campos.pointsRequired.trim();
  if (!/^\d+$/.test(puntos) || Number(puntos) < 1) {
    errores.pointsRequired = "Ingresa un número entero mayor que cero.";
  } else if (Number(puntos) > MAX_PUNTOS) {
    errores.pointsRequired = "Los puntos superan el máximo permitido.";
  }

  const valor = campos.discountValue.trim();
  if (!DECIMAL_2.test(valor) || Number(valor) <= 0) {
    errores.discountValue = "Ingresa un valor mayor que cero con máximo 2 decimales.";
  } else if (campos.discountType === "PERCENTAGE" && Number(valor) > 100) {
    errores.discountValue = "El porcentaje debe ser mayor que 0 y hasta 100.";
  } else if (Number(valor) > MAX_DECIMAL) {
    errores.discountValue = "El valor supera el máximo permitido.";
  }
  return errores;
}
