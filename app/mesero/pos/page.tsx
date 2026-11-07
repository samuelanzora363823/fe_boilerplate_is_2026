
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Table = {
  id: string;
  number: number;
  capacity: number;
  status: string;
  accounts: { id: string }[];
};

type Dish = {
  id: string;
  name: string;
  price: string;
  category: { name: string };
  imageUrl?: string | null;
};

type SavedOrder = {
  id: string;
  status: string;
  total: string;
  items: {
    id: string;
    dishId: string;
    quantity: number;
    unitPrice: string;
    subtotal: string;
    notes: string | null;
    dish: { name: string };
  }[];
};

type Item = {
  dishId: string;
  quantity: number;
  notes: string;
};

async function api(
  path: string,
  body?: unknown,
  method?: "PATCH"
) {
  const response = await fetch(`/api/mesero/${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message ?? `Error ${response.status}`
    );
  }

  return data;
}

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
    case "table":
      return (
        <svg {...props}>
          <rect x="3" y="7" width="18" height="8" rx="2" />
          <path d="M6 15v5M18 15v5M8 3h8" />
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
    case "trash":
      return (
        <svg {...props}>
          <path d="M4 7h16M10 3h4M7 7l1 14h8l1-14" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...props}>
          <path d="M20 7v5h-5M4 17v-5h5" />
          <path d="M5 9a7 7 0 0 1 13-2l2 5M4 12l2 5a7 7 0 0 0 13-2" />
        </svg>
      );
    case "send":
      return (
        <svg {...props}>
          <path d="m22 2-7 20-4-9-9-4 20-7Z" />
          <path d="M22 2 11 13" />
        </svg>
      );
    case "edit":
      return (
        <svg {...props}>
          <path d="m4 20 4-1 11-11a2 2 0 0 0-3-3L5 16l-1 4Z" />
        </svg>
      );
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="m16 16 5 5" />
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

function tableStatus(status: string) {
  if (status === "FREE") return "Libre";
  if (status === "OCCUPIED") return "Ocupada";
  if (status === "RESERVED") return "Reservada";
  return status;
}

export default function POS() {
  const [tables, setTables] = useState<Table[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [tableId, setTableId] = useState("");
  const [email, setEmail] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [accountId, setAccountId] = useState("");
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>([]);
  const [editedQuantities, setEditedQuantities] =
    useState<Record<string, number>>({});

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [tablesData, dishesData] = await Promise.all([
        api("tables/my-branch"),
        api("orders/table/menu"),
      ]);

      setTables(tablesData);
      setDishes(dishesData);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al cargar los datos"
      );
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) void refresh();
    });

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  function changeTable(id: string) {
    setTableId(id);
    setAccountId("");
    setSavedOrders([]);
    setEditedQuantities({});
    setItems([]);
    setEmail("");
    setMessage("");
    setError("");
  }

  function add(dishId: string) {
    setItems((previous) => {
      const existing = previous.find((item) => item.dishId === dishId);

      if (existing) {
        return previous.map((item) =>
          item.dishId === dishId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...previous, { dishId, quantity: 1, notes: "" }];
    });
  }

  function updateQuantity(dishId: string, quantity: number) {
    setItems((previous) =>
      previous.map((item) =>
        item.dishId === dishId ? { ...item, quantity } : item
      )
    );
  }

  function updateNotes(dishId: string, notes: string) {
    setItems((previous) =>
      previous.map((item) =>
        item.dishId === dishId
          ? { ...item, notes: notes.slice(0, 100) }
          : item
      )
    );
  }

  function remove(dishId: string) {
    setItems((previous) =>
      previous.filter((item) => item.dishId !== dishId)
    );
  }

  async function loadOrders(id: string) {
    const orders: SavedOrder[] = await api(`accounts/${id}/orders`);

    setSavedOrders(orders);
    setEditedQuantities(
      Object.fromEntries(
        orders.flatMap((order) =>
          order.items.map((item) => [item.id, item.quantity])
        )
      )
    );
  }

  async function open() {
    if (!tableId || loading) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await api("accounts", {
        tableId,
        ...(email.trim() ? { customerEmail: email.trim() } : {}),
      });

      setAccountId(result.id);
      await loadOrders(result.id);
      setMessage("Cuenta abierta correctamente.");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo abrir la cuenta"
      );
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    const invalid = items.some(
      (item) =>
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.notes.length > 100
    );

    if (!accountId || items.length === 0 || invalid || loading) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await api("orders/table", {
        accountId,
        items,
      });

      setItems([]);
      await loadOrders(accountId);
      setMessage(`Pedido ${result.id} registrado y enviado a cocina.`);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo registrar el pedido"
      );
    } finally {
      setLoading(false);
    }
  }

  async function modifySavedOrder(order: SavedOrder) {
    if (loading || order.status !== "RECEIVED") return;

    const updated = order.items.map((item) => ({
      itemId: item.id,
      quantity: editedQuantities[item.id] ?? item.quantity,
    }));

    if (
      updated.some(
        (item) =>
          !Number.isInteger(item.quantity) || item.quantity < 1
      )
    ) {
      setError("Las cantidades deben ser enteros mayores o iguales a 1.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await api(`orders/${order.id}`, { items: updated }, "PATCH");
      await loadOrders(accountId);
      setMessage("Pedido actualizado y cocina notificada.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo modificar el pedido"
      );
    } finally {
      setLoading(false);
    }
  }

  async function cancelSavedOrder(order: SavedOrder) {
    if (loading || order.status !== "RECEIVED") return;

    if (!window.confirm("¿Cancelar este pedido completo?")) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await api(`orders/${order.id}/cancel`, {}, "PATCH");
      await loadOrders(accountId);
      setMessage("Pedido cancelado y cocina notificada.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cancelar el pedido"
      );
    } finally {
      setLoading(false);
    }
  }

  const selected = tables.find((table) => table.id === tableId);

  const filteredDishes = useMemo(() => {
    const term = search.trim().toLowerCase();

    return dishes.filter(
      (dish) =>
        dish.name.toLowerCase().includes(term) ||
        dish.category.name.toLowerCase().includes(term)
    );
  }, [dishes, search]);

  const total = items.reduce((sum, item) => {
    const dish = dishes.find((dish) => dish.id === item.dishId);
    return sum + Number(dish?.price ?? 0) * item.quantity;
  }, 0);

  const invalidItems = items.some(
    (item) =>
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.notes.length > 100
  );

  const canOpenAccount = Boolean(
    !loading &&
      !loadingData &&
      tableId &&
      selected?.status !== "RESERVED"
  );

  const canSendOrder = Boolean(
    !loading && accountId && items.length > 0 && !invalidItems
  );

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
              <p className="text-lg font-bold">Núcleo Digital</p>
              <p className="text-xs text-slate-400">
                Sistema de restaurante
              </p>
            </div>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto p-4 lg:flex-col">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 hover:bg-white/10"
          >
            <Icon name="home" />
            Inicio
          </Link>

          <Link
            href="/mesero/pos"
            className="flex items-center gap-3 rounded-xl bg-[#7564e8] px-4 py-3 text-sm font-semibold text-white"
          >
            <Icon name="table" />
            Punto de venta
          </Link>
        </nav>

        <div className="mt-auto hidden border-t border-white/10 p-5 lg:block">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7564e8] font-semibold">
              M
            </div>
            <div>
              <p className="text-sm font-semibold">Mesero</p>
              <p className="text-xs text-slate-400">Atención al cliente</p>
            </div>
          </div>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-sm text-[#8c9cbd]">
                Administración / Punto de venta
              </p>
              <h1 className="text-3xl font-bold text-[#20233e]">
                Punto de venta
              </h1>
              <p className="mt-2 text-sm text-[#7184a6]">
                Gestiona mesas, cuentas y pedidos del restaurante.
              </p>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() => void refresh()}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <Icon name="refresh" size={18} />
              Actualizar
            </button>
          </header>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {message && (
            <div
              role="status"
              className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
            >
              {message}
            </div>
          )}

          {/* SELECCIONAR MESA */}
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0edff] text-[#7564e8]">
                <Icon name="table" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#20233e]">
                  1. Mesas y cuentas
                </h2>
                <p className="text-xs text-slate-400">
                  Selecciona una mesa para comenzar la atención.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-600">
                Mesa
                <select
                  value={tableId}
                  onChange={(event) => changeTable(event.target.value)}
                  disabled={loading || loadingData}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[#7564e8]"
                >
                  <option value="">
                    {loadingData ? "Cargando mesas..." : "Seleccionar mesa"}
                  </option>
                  {tables.map((table) => (
                    <option key={table.id} value={table.id}>
                      Mesa {table.number} · {table.capacity} personas ·{" "}
                      {tableStatus(table.status)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-slate-600">
                Correo del cliente (opcional)
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="cliente@ejemplo.com"
                  disabled={loading}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[#7564e8]"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4">
              <button
                type="button"
                disabled={!canOpenAccount}
                onClick={() => void open()}
                className="flex items-center gap-2 rounded-xl bg-[#7564e8] px-5 py-3 text-sm font-semibold text-white hover:bg-[#6250d5] disabled:opacity-50"
              >
                <Icon name="plus" size={18} />
                {loading
                  ? "Procesando..."
                  : accountId
                    ? "Consultar cuenta"
                    : "Abrir cuenta"}
              </button>

              {accountId && (
                <span className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                  Cuenta activa: {accountId}
                </span>
              )}
            </div>
          </section>

          {/* MENÚ Y PEDIDO */}
          <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
            {/* CATÁLOGO */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0edff] text-[#7564e8]">
                  <Icon name="menu" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#20233e]">
                    2. Seleccionar platillos
                  </h2>
                  <p className="text-xs text-slate-400">
                    Agrega los productos solicitados.
                  </p>
                </div>
              </div>

              <div className="relative mb-5">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Icon name="search" size={18} />
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar platillo o categoría..."
                  className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-[#7564e8]"
                />
              </div>

              <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
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
                      <p className="mt-1 text-xs text-slate-400">
                        {dish.category.name}
                      </p>
                      <p className="mt-2 text-sm font-bold text-[#7564e8]">
                        {money(dish.price)}
                      </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => add(dish.id)}
                      className="flex shrink-0 items-center gap-1 rounded-xl bg-[#7564e8] px-3 py-2 text-xs font-semibold text-white hover:bg-[#6250d5] disabled:opacity-50"
                    >
                      <Icon name="plus" size={16} />
                      Agregar
                    </button>
                  </div>
                ))}

                {!loadingData && filteredDishes.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-500">
                    No se encontraron platillos.
                  </p>
                )}
              </div>
            </section>

            {/* PEDIDO ACTUAL */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0edff] text-[#7564e8]">
                  <Icon name="cart" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#20233e]">
                    3. Pedido actual
                  </h2>
                  <p className="text-xs text-slate-400">
                    Confirma los productos antes de enviarlos.
                  </p>
                </div>
              </div>

              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0edff] text-[#7564e8]">
                    <Icon name="cart" size={24} />
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    Aún no hay platillos agregados.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => {
                    const dish = dishes.find(
                      (dish) => dish.id === item.dishId
                    );

                    return (
                      <div
                        key={item.dishId}
                        className="rounded-xl border border-slate-100 bg-[#fafbfe] p-4"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">
                              {dish?.name ?? "Platillo"}
                            </p>
                            <p className="mt-1 text-xs text-[#7564e8]">
                              {money(dish?.price ?? 0)} por unidad
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => remove(item.dishId)}
                            aria-label={`Quitar ${dish?.name ?? "platillo"}`}
                            className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Icon name="trash" size={17} />
                          </button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-[100px_1fr]">
                          <label className="text-xs text-slate-500">
                            Cantidad
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={item.quantity}
                              disabled={loading}
                              onChange={(event) =>
                                updateQuantity(
                                  item.dishId,
                                  Number(event.target.value)
                                )
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                            />
                          </label>

                          <label className="text-xs text-slate-500">
                            Notas especiales
                            <textarea
                              rows={1}
                              maxLength={100}
                              value={item.notes}
                              disabled={loading}
                              onChange={(event) =>
                                updateNotes(item.dishId, event.target.value)
                              }
                              placeholder="Sin cebolla, extra salsa..."
                              className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
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
                  disabled={!canSendOrder}
                  onClick={() => void send()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7564e8] px-5 py-3.5 text-sm font-semibold text-white hover:bg-[#6250d5] disabled:opacity-50"
                >
                  <Icon name="send" size={18} />
                  {loading ? "Enviando..." : "Enviar a cocina"}
                </button>

                {!accountId && (
                  <p className="mt-3 text-center text-xs text-slate-400">
                    Debes abrir una cuenta antes de enviar el pedido.
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* H6 */}
          {accountId && (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0edff] text-[#7564e8]">
                    <Icon name="edit" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#20233e]">
                      4. Gestión de pedidos
                    </h2>
                    <p className="text-xs text-slate-400">
                      Modifica o cancela pedidos registrados (H6).
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    void loadOrders(accountId).catch((err) =>
                      setError(
                        err instanceof Error
                          ? err.message
                          : "No se pudo consultar"
                      )
                    )
                  }
                  className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Icon name="refresh" size={16} />
                  Actualizar lista
                </button>
              </div>

              {savedOrders.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
                  No hay pedidos registrados en esta cuenta.
                </p>
              )}

              <div className="space-y-4">
                {savedOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-xl border border-slate-200 p-5"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[#252944]">
                          Pedido {order.id}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Total: {money(order.total)}
                        </p>
                      </div>

                      <span
                        className={
                          order.status === "RECEIVED"
                            ? "rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700"
                            : "rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
                        }
                      >
                        {order.status}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {order.items.map((item) => (
                        <label
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#fafbfe] p-3"
                        >
                          <span className="text-sm">
                            <strong>{item.dish.name}</strong>
                            <span className="ml-2 text-slate-400">
                              {money(item.unitPrice)} por unidad
                            </span>
                          </span>

                          <input
                            type="number"
                            min={1}
                            step={1}
                            aria-label={`Cantidad de ${item.dish.name}`}
                            value={
                              editedQuantities[item.id] ?? item.quantity
                            }
                            disabled={
                              loading || order.status !== "RECEIVED"
                            }
                            onChange={(event) =>
                              setEditedQuantities((previous) => ({
                                ...previous,
                                [item.id]: Number(event.target.value),
                              }))
                            }
                            className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                          />
                        </label>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={
                          loading || order.status !== "RECEIVED"
                        }
                        onClick={() => void modifySavedOrder(order)}
                        className="flex items-center gap-2 rounded-xl bg-[#7564e8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6250d5] disabled:opacity-50"
                      >
                        <Icon name="edit" size={16} />
                        Guardar cantidades
                      </button>

                      <button
                        type="button"
                        disabled={
                          loading || order.status !== "RECEIVED"
                        }
                        onClick={() => void cancelSavedOrder(order)}
                        className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                      >
                        <Icon name="trash" size={16} />
                        Cancelar pedido
                      </button>
                    </div>

                    {order.status !== "RECEIVED" && (
                      <p className="mt-3 text-xs text-slate-400">
                        Este pedido ya no está en estado Recibido y no
                        puede modificarse ni cancelarse.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <footer className="mt-10 border-t border-slate-200 py-5 text-center text-xs text-slate-400">
            Núcleo Digital · Punto de venta · Mesero
          </footer>
        </div>
      </main>
    </div>
  );
}
