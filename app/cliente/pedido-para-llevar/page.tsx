"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  obtenerPedidosTakeawayCliente,
  type PedidoTakeawayCliente,
} from "@/lib/services/loyalty";

type Branch = {
  id: string;
  name: string;
};

type Dish = {
  id: string;
  name: string;
  price: string | number;
  category?: string;
  imageUrl?: string | null;
};

type CartItem = {
  dish: Dish;
  quantity: number;
  notes: string;
};

type Result = {
  orderId: string;
  orderNumber: string;
  status: string;
  // true cuando se abrió un pedido pendiente ya registrado (no recién creado).
  existente?: boolean;
};

type TakeawayDetail = {
  orderId: string;
  orderNumber: string;
  status: string;
  branch: { name: string; code: string };
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number | string;
    subtotal: number | string;
  }>;
  subtotal: number | string;
  discount: number | string;
  tax: number | string;
  total: number | string;
};

type TakeawayReceipt = {
  id: string;
  number: number;
  branch: { name: string; code: string };
  issuedAt: string;
  subtotal: number | string;
  discount: number | string;
  tax: number | string;
  total: number | string;
  paymentMethod: string;
  items: TakeawayDetail["items"];
  order: { id: string; orderNumber: string };
};

type TakeawayPaymentResponse = {
  paymentId: string;
  status: "APPROVED" | "REJECTED";
  message: string;
  receipt?: TakeawayReceipt;
};




function Icon({
  name,
  size = 20,
}: {
  name: string;
  size?: number;
}) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "home":
      return (
        <svg {...props}>
          <path d="m3 10 9-7 9 7v10H3z" />
          <path d="M9 20v-7h6v7" />
        </svg>
      );

    case "menu":
      return (
        <svg {...props}>
          <path d="M4 5h16M4 12h16M4 19h16" />
        </svg>
      );

    case "bag":
      return (
        <svg {...props}>
          <path d="M5 9h14l-1 12H6L5 9Z" />
          <path d="M9 9V6a3 3 0 0 1 6 0v3" />
        </svg>
      );

    case "cart":
      return (
        <svg {...props}>
          <circle cx="9" cy="20" r="1" />
          <circle cx="19" cy="20" r="1" />
          <path d="M2 3h2l3 12h12l3-9H5" />
        </svg>
      );

    case "plus":
      return (
        <svg {...props}>
          <path d="M12 4v16M4 12h16" />
        </svg>
      );

    case "minus":
      return (
        <svg {...props}>
          <path d="M4 12h16" />
        </svg>
      );

    case "trash":
      return (
        <svg {...props}>
          <path d="M4 7h16M10 3h4M7 7l1 14h8l1-14" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      );

    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="m16 16 5 5" />
        </svg>
      );

    case "store":
      return (
        <svg {...props}>
          <path d="M3 10h18l-2-7H5l-2 7Z" />
          <path d="M5 10v11h14V10M9 21v-7h6v7" />
        </svg>
      );

    case "check":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 3 3 5-6" />
        </svg>
      );

    case "arrow":
      return (
        <svg {...props}>
          <path d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
      );

    case "info":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 7h.01" />
        </svg>
      );

    default:
      return (
        <svg {...props}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
        </svg>
      );
  }
}

function money(value: number | string) {
  return `$${Number(value).toFixed(2)}`;
}

export default function TakeawayPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [result, setResult] = useState<Result | null>(null);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [loadingDishes, setLoadingDishes] = useState(false);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<TakeawayDetail | null>(null);
  const [cardLast4, setCardLast4] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [receipt, setReceipt] = useState<TakeawayReceipt | null>(null);
  // Pedidos para llevar propios que siguen pendientes de pago.
  const [pendientes, setPendientes] = useState<PedidoTakeawayCliente[]>([]);
  const [cargandoPendientes, setCargandoPendientes] = useState(true);
  const [errorPendientes, setErrorPendientes] = useState("");

  // El backend (GET /orders/takeaway/mine) solo devuelve pedidos del cliente
  // autenticado; aquí se muestran únicamente los que esperan pago.
  const cargarPendientes = useCallback(async () => {
    setCargandoPendientes(true);
    setErrorPendientes("");
    try {
      const pedidos = await obtenerPedidosTakeawayCliente();
      setPendientes(
        (Array.isArray(pedidos) ? pedidos : []).filter(
          (pedido) => pedido.status === "PENDING_PAYMENT"
        )
      );
    } catch {
      setErrorPendientes("No se pudieron cargar tus pedidos pendientes de pago.");
    } finally {
      setCargandoPendientes(false);
    }
  }, []);

  useEffect(() => {
    // Se difiere para no llamar setState de forma síncrona dentro del efecto.
    queueMicrotask(() => {
      void cargarPendientes();
    });
  }, [cargarPendientes]);

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum + Number(item.dish.price) * item.quantity,
        0
      ),
    [cart]
  );

  const totalItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const filteredDishes = useMemo(() => {
    const term = search.trim().toLowerCase();

    return dishes.filter(
      (dish) =>
        dish.name.toLowerCase().includes(term) ||
        (dish.category ?? "").toLowerCase().includes(term)
    );
  }, [dishes, search]);

  const selectedBranch = branches.find(
    (branch) => branch.id === branchId
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadBranches() {
      try {
        const response = await fetch("/api/menu/branches", {
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok || !Array.isArray(data)) {
          throw new Error("No se pudieron cargar las sucursales.");
        }

        if (!controller.signal.aborted) {
          setBranches(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Error al consultar sucursales."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingBranches(false);
        }
      }
    }

    void loadBranches();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!branchId) return;

    const controller = new AbortController();

    async function loadDishes() {
      try {
        const response = await fetch(
          `/api/menu/branch/${encodeURIComponent(branchId)}/filter`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            Array.isArray(data.message)
              ? data.message.join(", ")
              : data.message ?? "Error al consultar menú."
          );
        }

        if (!Array.isArray(data)) {
          throw new Error("El menú recibido no es válido.");
        }

        if (!controller.signal.aborted) {
          setDishes(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar el menú."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingDishes(false);
        }
      }
    }

    // La carga se inicia en una microtarea para evitar
    // actualizar el estado sincrónicamente en el efecto.
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setLoadingDishes(true);
        void loadDishes();
      }
    });

    return () => controller.abort();
  }, [branchId]);

  function changeBranch(id: string) {
    setBranchId(id);
    setCart([]);
    setDishes([]);
    setSearch("");
    setError("");
    setLoadingDishes(Boolean(id));
  }

  function add(dish: Dish) {
    setCart((previous) => {
      const existing = previous.find(
        (item) => item.dish.id === dish.id
      );

      if (existing) {
        return previous.map((item) =>
          item.dish.id === dish.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...previous,
        { dish, quantity: 1, notes: "" },
      ];
    });
  }

  function updateQuantity(dishId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1) return;

    setCart((previous) =>
      previous.map((item) =>
        item.dish.id === dishId
          ? { ...item, quantity }
          : item
      )
    );
  }

  function updateNotes(dishId: string, notes: string) {
    setCart((previous) =>
      previous.map((item) =>
        item.dish.id === dishId
          ? { ...item, notes: notes.slice(0, 100) }
          : item
      )
    );
  }

  function remove(dishId: string) {
    setCart((previous) =>
      previous.filter((item) => item.dish.id !== dishId)
    );
  }

  async function loadTakeawayDetail(orderId: string) {
    setPaymentError("");
    setDetail(null);

    try {
      const response = await fetch(
        `/api/cliente/takeaway/${encodeURIComponent(orderId)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(", ")
            : data.message ?? "No se pudo consultar el detalle del pedido."
        );
      }

      setDetail(data as TakeawayDetail);
    } catch (err) {
      setPaymentError(
        err instanceof Error
          ? err.message
          : "No se pudo consultar el detalle del pedido."
      );
    }
  }

  // Vuelve a consultar el detalle tras un pago aprobado sin ocultar la
  // pantalla actual; si falla, se conserva el detalle mostrado.
  async function refrescarEstadoPedido(orderId: string) {
    try {
      const response = await fetch(
        `/api/cliente/takeaway/${encodeURIComponent(orderId)}`,
        { method: "GET", cache: "no-store" }
      );
      if (!response.ok) return;
      setDetail((await response.json()) as TakeawayDetail);
    } catch {
      // El comprobante ya confirma el pago; el estado se verá al recargar.
    }
  }

  // Abre un pedido pendiente existente y reutiliza el detalle y el
  // formulario de pago; no crea un pedido nuevo.
  function seleccionarPendiente(pedido: PedidoTakeawayCliente) {
    setError("");
    setCardLast4("");
    setPaymentError("");
    setPaymentMessage("");
    setReceipt(null);
    setResult({
      orderId: pedido.id,
      orderNumber: pedido.orderNumber,
      status: pedido.status,
      existente: true,
    });
    void loadTakeawayDetail(pedido.id);
  }

  async function payTakeawayOrder() {
    if (!result || !/^(4242|0002)$/.test(cardLast4) || paymentBusy || receipt) {
      return;
    }

    setPaymentBusy(true);
    setPaymentError("");
    setPaymentMessage("");

    try {
      const response = await fetch(
        `/api/cliente/takeaway/${encodeURIComponent(result.orderId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardLast4 }),
        }
      );

      const data = (await response.json()) as TakeawayPaymentResponse & {
        message?: string | string[];
      };

      if (!response.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(", ")
            : data.message ?? "No se pudo procesar el pago."
        );
      }

      if (data.status === "REJECTED") {
        setPaymentMessage(
          "Pago rechazado. Intente con otro método de pago"
        );
        setReceipt(null);
        return;
      }

      if (data.status === "APPROVED" && data.receipt) {
        setReceipt(data.receipt);
        setPaymentMessage("Pago aprobado");
        // Refleja el nuevo estado del pedido y lo quita de los pendientes.
        await Promise.all([
          refrescarEstadoPedido(result.orderId),
          cargarPendientes(),
        ]);
        return;
      }

      throw new Error("La respuesta del pago no contiene un comprobante válido.");
    } catch (err) {
      setPaymentError(
        err instanceof Error ? err.message : "No se pudo procesar el pago."
      );
    } finally {
      setPaymentBusy(false);
    }
  }

  async function confirm() {
    if (!branchId || !cart.length || busy) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/cliente/takeaway", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          branchId,
          items: cart.map((item) => ({
            dishId: item.dish.id,
            quantity: item.quantity,
            notes: item.notes,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(", ")
            : data.message ?? "No se pudo registrar el pedido."
        );
      }

      setResult(data);
      setCart([]);
      setCardLast4("");
      setPaymentMessage("");
      setReceipt(null);
      await loadTakeawayDetail(data.orderId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error desconocido."
      );
    } finally {
      setBusy(false);
    }
  }

  function newOrder() {
    setResult(null);
    setCart([]);
    setError("");
    setDetail(null);
    setCardLast4("");
    setPaymentError("");
    setPaymentMessage("");
    setReceipt(null);
    void cargarPendientes();
  }

  return (
    <div className="min-h-screen bg-[#f5f6fb] text-[#252944] lg:flex">
      {/* BARRA LATERAL */}
      <aside className="flex w-full flex-col bg-[#171b36] text-white lg:min-h-screen lg:w-64 lg:shrink-0">
        <div className="border-b border-white/10 px-6 py-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7564e8] text-xl font-bold">
              N
            </div>

            <div>
              <p className="text-lg font-bold tracking-tight">
                Núcleo Digital
              </p>
              <p className="text-xs text-slate-400">
                Sistema de restaurante
              </p>
            </div>
          </div>
        </div>

        <nav
          aria-label="Navegación principal"
          className="flex gap-2 overflow-x-auto p-4 lg:flex-col"
        >
          <Link
            href="/"
            className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <Icon name="home" />
            Inicio
          </Link>

          <Link
            href="/menu"
            className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <Icon name="menu" />
            Consultar menú
          </Link>

          <Link
            href="/cliente/pedido-para-llevar"
            aria-current="page"
            className="flex shrink-0 items-center gap-3 rounded-xl bg-[#7564e8] px-4 py-3 text-sm font-semibold text-white"
          >
            <Icon name="bag" />
            Pedido para llevar
          </Link>
        </nav>

        <div className="mt-auto hidden border-t border-white/10 p-5 lg:block">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7564e8] font-semibold">
              C
            </div>

            <div>
              <p className="text-sm font-semibold">Cliente</p>
              <p className="text-xs text-slate-400">
                Pedidos para llevar
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-7">
            <p className="mb-2 text-sm text-[#8c9cbd]">
              Núcleo Digital / Cliente / Pedido para llevar
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-[#20233e]">
              Pedido para llevar
            </h1>

            <p className="mt-2 text-sm text-[#7184a6]">
              Selecciona una sucursal, elige tus platillos y registra
              tu pedido.
            </p>
          </header>

          {/* AVISO DE PAGO */}
          <div className="mb-7 flex items-start gap-3 rounded-2xl border border-[#ddd6fe] bg-[#f0edff] p-5">
            <div className="mt-0.5 text-[#7564e8]">
              <Icon name="info" size={22} />
            </div>

            <div>
              <p className="text-sm font-bold text-[#5546ba]">
                Información importante sobre el pago
              </p>
              <p className="mt-1 text-sm leading-6 text-[#6258a5]">
                El pedido quedará pendiente de pago. No se enviará a
                cocina hasta que se confirme el pago.
              </p>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {result ? (
            <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
                  <Icon name="check" size={34} />
                </div>
                <h2 className="text-2xl font-bold text-[#20233e]">
                  {receipt
                    ? "¡Pago completado!"
                    : result.existente
                      ? "Pedido pendiente de pago"
                      : "¡Pedido registrado!"}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {receipt
                    ? "Tu pago fue aprobado y el pedido quedó confirmado."
                    : "Revisa el detalle y realiza el pago para confirmar tu compra."}
                </p>
                <div className="mt-5 inline-block rounded-xl bg-[#f5f6fb] px-6 py-4">
                  <p className="text-xs text-slate-500">Número de orden</p>
                  <p className="mt-1 text-2xl font-bold text-[#7564e8]">
                    {result.orderNumber}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Estado: {detail?.status ?? result.status}
                  </p>
                </div>
              </div>

              {paymentError && (
                <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {paymentError}
                  {!detail && !receipt && (
                    <button
                      type="button"
                      onClick={() => void loadTakeawayDetail(result.orderId)}
                      className="ml-2 font-semibold underline"
                    >
                      Volver a consultar
                    </button>
                  )}
                </div>
              )}

              {detail ? (
                <div className="rounded-2xl border border-slate-100 p-5">
                  <h3 className="mb-4 text-lg font-bold text-[#20233e]">
                    Detalle del pedido
                  </h3>
                  <div className="mb-4 flex flex-wrap justify-between gap-2 text-sm text-slate-500">
                    <span>Sucursal: {detail.branch.name}</span>
                    <span>Código: {detail.branch.code}</span>
                  </div>

                  <div className="space-y-3">
                    {detail.items.map((item, index) => (
                      <div key={`${item.productName}-${index}`} className="flex justify-between gap-4 border-b border-slate-100 pb-3 text-sm">
                        <div>
                          <p className="font-semibold text-[#252944]">{item.productName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.quantity} × {money(item.unitPrice)}
                          </p>
                        </div>
                        <p className="font-semibold text-[#252944]">{money(item.subtotal)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Subtotal</span>
                      <span>{money(detail.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Descuento</span>
                      <span>-{money(detail.discount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">IVA (13%)</span>
                      <span>{money(detail.tax)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-bold">
                      <span>Total</span>
                      <span className="text-[#7564e8]">{money(detail.total)}</span>
                    </div>
                  </div>
                </div>
              ) : !paymentError ? (
                <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
                  Consultando el detalle del pedido...
                </p>
              ) : null}

              {paymentMessage && (
                <div role="status" className={`mt-5 rounded-xl p-4 text-sm font-semibold ${
                  receipt ? "border border-green-200 bg-green-50 text-green-700" : "border border-red-200 bg-red-50 text-red-700"
                }`}>
                  {paymentMessage}
                </div>
              )}

              {receipt ? (
                <div className="mt-6 rounded-2xl border border-green-200 bg-green-50/50 p-5">
                  <h3 className="text-lg font-bold text-[#20233e]">Comprobante de pago</h3>
                  <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <p><span className="text-slate-500">Comprobante:</span> #{receipt.number}</p>
                    <p><span className="text-slate-500">Sucursal:</span> {receipt.branch.name}</p>
                    <p><span className="text-slate-500">Fecha:</span> {new Date(receipt.issuedAt).toLocaleString("es-SV")}</p>
                    <p><span className="text-slate-500">Método:</span> {receipt.paymentMethod}</p>
                  </div>
                  <div className="mt-5 border-t border-green-200 pt-4">
                    <p className="mb-3 text-sm font-semibold text-[#20233e]">Productos</p>
                    <div className="space-y-2 text-sm">
                      {receipt.items.map((item, index) => (
                        <div key={`${item.productName}-${index}`} className="flex justify-between gap-3">
                          <span>{item.quantity} × {item.productName}</span>
                          <span className="font-medium">{money(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 border-t border-green-200 pt-4 text-sm">
                    <div className="flex justify-between"><span>Subtotal</span><span>{money(receipt.subtotal)}</span></div>
                    <div className="flex justify-between"><span>Descuento</span><span>-{money(receipt.discount)}</span></div>
                    <div className="flex justify-between"><span>IVA</span><span>{money(receipt.tax)}</span></div>
                    <div className="flex justify-between border-t border-green-200 pt-3 text-lg font-bold"><span>Total pagado</span><span>{money(receipt.total)}</span></div>
                  </div>
                </div>
              ) : detail && (
                <div className="mt-6 rounded-2xl border border-slate-200 p-5">
                  <h3 className="text-lg font-bold text-[#20233e]">Pago en línea con tarjeta</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Ingresa los últimos cuatro dígitos de la tarjeta para simular el pago.
                  </p>
                  <label className="mt-4 block text-sm font-medium text-slate-600">
                    Últimos cuatro dígitos
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={4}
                      value={cardLast4}
                      disabled={paymentBusy}
                      onChange={(event) => {
                        setCardLast4(event.target.value.replace(/\D/g, "").slice(0, 4));
                        setPaymentMessage("");
                        setPaymentError("");
                      }}
                      placeholder="4242"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#7564e8] disabled:bg-slate-50"
                    />
                  </label>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Para la simulación: 4242 aprueba el pago y 0002 lo rechaza. No ingreses ni almacenes el número completo ni el CVV.
                  </p>
                  <button
                    type="button"
                    disabled={paymentBusy || !/^(4242|0002)$/.test(cardLast4)}
                    onClick={() => void payTakeawayOrder()}
                    className="mt-5 flex w-full items-center justify-center rounded-xl bg-[#7564e8] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#6250d5] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {paymentBusy ? "Procesando pago..." : `Pagar ${money(detail.total)}`}
                  </button>
                </div>
              )}

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={newOrder}
                  disabled={paymentBusy}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <Icon name="plus" size={18} />
                  {result.existente && !receipt
                    ? "Volver a mis pedidos"
                    : "Realizar otro pedido"}
                </button>
              </div>
            </section>
          ) : (
            <>
              {/* PEDIDOS PENDIENTES DE PAGO (registrados anteriormente) */}
              {(cargandoPendientes || errorPendientes || pendientes.length > 0) && (
                <section className="mb-6 rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      <Icon name="bag" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-[#20233e]">
                        Pedidos pendientes de pago
                      </h2>
                      <p className="text-xs text-slate-400">
                        Pedidos que ya registraste y aún no has pagado. Selecciona uno para revisar su detalle y pagarlo.
                      </p>
                    </div>
                  </div>

                  {cargandoPendientes ? (
                    <p className="text-sm text-slate-500">Cargando tus pedidos pendientes...</p>
                  ) : errorPendientes ? (
                    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {errorPendientes}
                      <button
                        type="button"
                        onClick={() => void cargarPendientes()}
                        className="ml-2 font-semibold underline"
                      >
                        Reintentar
                      </button>
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {pendientes.map((pedido) => (
                        <li
                          key={pedido.id}
                          className="flex flex-wrap items-center justify-between gap-3 py-3"
                        >
                          <div>
                            <p className="font-semibold text-[#252944]">
                              Pedido {pedido.orderNumber}
                            </p>
                            <p className="text-xs text-slate-500">
                              Registrado el{" "}
                              {new Date(pedido.createdAt).toLocaleString("es-SV", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}{" "}
                              · Subtotal {money(pedido.total)} (sin IVA)
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => seleccionarPendiente(pedido)}
                            disabled={busy}
                            className="rounded-xl bg-[#7564e8] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6250d5] disabled:opacity-50"
                          >
                            Ver detalle y pagar
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {/* SUCURSAL */}
              <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0edff] text-[#7564e8]">
                    <Icon name="store" />
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-[#20233e]">
                      1. Selecciona una sucursal
                    </h2>
                    <p className="text-xs text-slate-400">
                      Elige dónde deseas recoger tu pedido.
                    </p>
                  </div>
                </div>

                <label className="block max-w-xl text-sm font-medium text-slate-600">
                  Sucursal
                  <select
                    value={branchId}
                    disabled={busy || loadingBranches}
                    onChange={(event) =>
                      changeBranch(event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#7564e8]"
                  >
                    <option value="">
                      {loadingBranches
                        ? "Cargando sucursales..."
                        : "Selecciona una sucursal"}
                    </option>

                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedBranch && (
                  <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                    <Icon name="check" size={15} />
                    Sucursal seleccionada: {selectedBranch.name}
                  </p>
                )}
              </section>

              {/* MENÚ Y CARRITO */}
              <div className="grid items-start gap-6 xl:grid-cols-[1.15fr_1fr]">
                {/* CATÁLOGO */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0edff] text-[#7564e8]">
                      <Icon name="menu" />
                    </div>

                    <div>
                      <h2 className="text-lg font-bold text-[#20233e]">
                        2. Selecciona tus platillos
                      </h2>
                      <p className="text-xs text-slate-400">
                        Explora los productos disponibles.
                      </p>
                    </div>
                  </div>

                  <div className="relative mb-5">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Icon name="search" size={18} />
                    </span>

                    <input
                      type="search"
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder="Buscar platillos..."
                      disabled={!branchId || loadingDishes}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-[#7564e8] disabled:bg-slate-50"
                    />
                  </div>

                  {!branchId ? (
                    <div className="rounded-xl border border-dashed border-slate-200 px-5 py-12 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0edff] text-[#7564e8]">
                        <Icon name="store" size={24} />
                      </div>
                      <p className="text-sm font-medium text-slate-500">
                        Primero selecciona una sucursal.
                      </p>
                    </div>
                  ) : loadingDishes ? (
                    <p className="py-12 text-center text-sm text-slate-500">
                      Cargando platillos...
                    </p>
                  ) : (
                    <div className="max-h-[550px] space-y-3 overflow-y-auto pr-1">
                      {filteredDishes.map((dish) => (
                        <div
                          key={dish.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-[#fafbfe] p-4"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            {dish.imageUrl && <img src={dish.imageUrl} alt={dish.name} className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
                            <div className="min-w-0">
                            <p className="font-semibold text-[#252944]">
                              {dish.name}
                            </p>

                            {dish.category && (
                              <p className="mt-1 text-xs text-slate-400">
                                {dish.category}
                              </p>
                            )}

                            <p className="mt-2 text-sm font-bold text-[#7564e8]">
                              {money(dish.price)}
                            </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => add(dish)}
                            className="flex shrink-0 items-center gap-1 rounded-xl bg-[#7564e8] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#6250d5] disabled:opacity-50"
                          >
                            <Icon name="plus" size={16} />
                            Agregar
                          </button>
                        </div>
                      ))}

                      {filteredDishes.length === 0 && (
                        <p className="py-10 text-center text-sm text-slate-500">
                          No se encontraron platillos disponibles.
                        </p>
                      )}
                    </div>
                  )}
                </section>

                {/* CARRITO */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0edff] text-[#7564e8]">
                        <Icon name="cart" />
                      </div>

                      <div>
                        <h2 className="text-lg font-bold text-[#20233e]">
                          3. Tu carrito
                        </h2>
                        <p className="text-xs text-slate-400">
                          Revisa tu pedido antes de confirmarlo.
                        </p>
                      </div>
                    </div>

                    <span className="rounded-full bg-[#f0edff] px-3 py-1 text-xs font-bold text-[#7564e8]">
                      {totalItems}
                    </span>
                  </div>

                  {cart.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0edff] text-[#7564e8]">
                        <Icon name="cart" size={24} />
                      </div>

                      <p className="text-sm font-medium text-slate-500">
                        Tu carrito está vacío.
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Agrega platillos para comenzar.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <div
                          key={item.dish.id}
                          className="rounded-xl border border-slate-100 bg-[#fafbfe] p-4"
                        >
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-[#252944]">
                                {item.dish.name}
                              </p>

                              <p className="mt-1 text-xs font-semibold text-[#7564e8]">
                                {money(item.dish.price)} por unidad
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => remove(item.dish.id)}
                              aria-label={`Quitar ${item.dish.name}`}
                              className="rounded-lg p-2 text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              <Icon name="trash" size={17} />
                            </button>
                          </div>

                          <div className="mb-4 flex items-center justify-between gap-3">
                            <span className="text-xs font-medium text-slate-500">
                              Cantidad
                            </span>

                            <div className="flex items-center rounded-lg border border-slate-200 bg-white">
                              <button
                                type="button"
                                disabled={busy || item.quantity <= 1}
                                onClick={() =>
                                  updateQuantity(
                                    item.dish.id,
                                    item.quantity - 1
                                  )
                                }
                                aria-label={`Disminuir ${item.dish.name}`}
                                className="px-3 py-2 text-slate-600 disabled:opacity-30"
                              >
                                <Icon name="minus" size={15} />
                              </button>

                              <span className="min-w-8 text-center text-sm font-semibold">
                                {item.quantity}
                              </span>

                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  updateQuantity(
                                    item.dish.id,
                                    item.quantity + 1
                                  )
                                }
                                aria-label={`Aumentar ${item.dish.name}`}
                                className="px-3 py-2 text-slate-600 disabled:opacity-30"
                              >
                                <Icon name="plus" size={15} />
                              </button>
                            </div>
                          </div>

                          <label className="block text-xs font-medium text-slate-500">
                            Notas especiales
                            <input
                              type="text"
                              maxLength={100}
                              disabled={busy}
                              value={item.notes}
                              onChange={(event) =>
                                updateNotes(
                                  item.dish.id,
                                  event.target.value
                                )
                              }
                              placeholder="Ej. Sin cebolla"
                              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#7564e8]"
                            />
                          </label>

                          <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
                            <span className="text-sm font-bold text-[#252944]">
                              {money(
                                Number(item.dish.price) * item.quantity
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <div className="mb-5 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-500">
                        Total del pedido
                      </span>

                      <span className="text-2xl font-bold text-[#20233e]">
                        {money(total)}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!branchId || !cart.length || busy}
                      onClick={() => void confirm()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7564e8] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#6250d5] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy
                        ? "Registrando pedido..."
                        : "Confirmar pedido"}
                      {!busy && <Icon name="arrow" size={18} />}
                    </button>

                    <p className="mt-3 text-center text-xs leading-5 text-slate-400">
                      El pedido quedará pendiente de pago.
                      No se realizará ningún cobro en esta pantalla.
                    </p>
                  </div>
                </section>
              </div>
            </>
          )}

          <footer className="mt-12 border-t border-slate-200 py-5 text-center text-xs text-[#94a3b8]">
            Núcleo Digital · Sistema de gestión de restaurante
          </footer>
        </div>
      </main>
    </div>
  );
}
