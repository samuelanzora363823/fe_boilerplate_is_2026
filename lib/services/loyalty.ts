export class LoyaltyApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "LoyaltyApiError";
    this.status = status;
  }
}

export async function consultarLealtad<T>(
  ruta: string,
  opciones?: RequestInit,
): Promise<T> {
  const respuesta = await fetch(ruta, {
    ...opciones,
    cache: "no-store",
  });
  const datos: unknown = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const cuerpo =
      datos !== null && typeof datos === "object"
        ? (datos as Record<string, unknown>)
        : null;
    const mensaje = typeof cuerpo?.message === "string" ? cuerpo.message : "";
    throw new LoyaltyApiError(respuesta.status, mensaje);
  }

  return datos as T;
}

// H20: contrato de GET /loyalty/points/balance.
// - totalPoints: puntos acumulados, incluidos los reservados.
// - reservedPoints: puntos apartados por canjes pendientes de pago.
// - availablePoints: puntos que el cliente puede usar ahora.
// - balance: alias de totalPoints por compatibilidad; no usarlo como disponible.
export type SaldoLealtad = {
  totalPoints: number;
  reservedPoints: number;
  availablePoints: number;
  balance: number;
};

function numeroNoNegativo(valor: unknown): number | null {
  const numero = typeof valor === "string" && valor.trim() ? Number(valor) : valor;
  return typeof numero === "number" && Number.isFinite(numero) && numero >= 0
    ? numero
    : null;
}

// Valida la respuesta del saldo. Devuelve null si falta availablePoints u otro
// campo obligatorio, para no confundir el total con los puntos disponibles.
export function normalizarSaldoLealtad(valor: unknown): SaldoLealtad | null {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) {
    return null;
  }

  const datos = valor as Record<string, unknown>;
  const totalPoints = numeroNoNegativo(datos.totalPoints);
  const reservedPoints = numeroNoNegativo(datos.reservedPoints);
  const availablePoints = numeroNoNegativo(datos.availablePoints);

  if (totalPoints === null || reservedPoints === null || availablePoints === null) {
    return null;
  }

  return {
    totalPoints,
    reservedPoints,
    availablePoints,
    balance: numeroNoNegativo(datos.balance) ?? totalPoints,
  };
}

// Saldo de un cliente que todavía no tiene cuenta de puntos.
export const SALDO_LEALTAD_VACIO: SaldoLealtad = {
  totalPoints: 0,
  reservedPoints: 0,
  availablePoints: 0,
  balance: 0,
};

export type BeneficioLealtad = {
  id: string;
  name: string;
  pointsRequired: number;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number | string;
  active: boolean;
};

export type BeneficiosLealtad = { items: BeneficioLealtad[] };

export type PedidoTakeawayCliente = {
  id: string;
  orderNumber: string;
  status: string;
  total: number | string;
  createdAt: string;
  hasReview: boolean;
};

export type CompraParaCanje =
  | { accountId: string; orderId?: never }
  | { orderId: string; accountId?: never };

export type SolicitudCanje = { benefitId: string } & CompraParaCanje;

export type ResultadoCanje = {
  id: string;
  pointsRedeemed: number;
  // Contrato anterior de POST /redemptions: no usarlo como saldo; volver a
  // consultar GET /loyalty/points/balance después del canje.
  balance: number;
  discountApplied: number;
  status: "RESERVADO";
};

// Consulta y valida el saldo. Un 404 (cliente sin cuenta de puntos) equivale a
// saldo cero, igual que la respuesta actual del backend en ese caso.
export async function obtenerSaldoLealtad(): Promise<SaldoLealtad> {
  let datos: unknown;

  try {
    datos = await consultarLealtad<unknown>("/api/cliente/loyalty/balance");
  } catch (error) {
    if (error instanceof LoyaltyApiError && error.status === 404) {
      return { ...SALDO_LEALTAD_VACIO };
    }
    throw error;
  }

  const saldo = normalizarSaldoLealtad(datos);
  if (!saldo) {
    throw new Error("No se pudo interpretar el saldo de puntos recibido.");
  }
  return saldo;
}

export function obtenerBeneficiosLealtad() {
  return consultarLealtad<BeneficiosLealtad>("/api/cliente/loyalty/benefits");
}

export function obtenerPedidosTakeawayCliente() {
  return consultarLealtad<PedidoTakeawayCliente[]>("/api/cliente/takeaway");
}

export function solicitarCanjeLealtad(solicitud: SolicitudCanje) {
  return consultarLealtad<ResultadoCanje>("/api/cliente/loyalty/redemptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(solicitud),
  });
}
