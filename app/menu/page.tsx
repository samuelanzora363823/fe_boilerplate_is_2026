"use client";

import { useEffect, useMemo, useState } from "react";

type Branch = { id: string; name: string };
type Dish = { id: string; name: string; description: string | null; price: string | number; category: string; tags: string[] };
type CartItem = { dishId: string; branchId: string; quantity: number };

export default function PublicMenu() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/menu/branches", { cache: "no-store" })
      .then(async r => { if (!r.ok) throw new Error("No se pudieron consultar las sucursales"); return r.json(); })
      .then((data: Branch[]) => setBranches(data))
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!branchId) { setDishes([]); return; }
    const controller = new AbortController();
    fetch(`/api/menu/branch/${branchId}`, { signal: controller.signal, cache: "no-store" })
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.message ?? "No se pudo consultar el menú"); return data; })
      .then((data: Dish[]) => { setDishes(data); setError(""); })
      .catch((e: Error) => { if (e.name !== "AbortError") { setError(e.message); setDishes([]); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [branchId]);

  const grouped = useMemo(() => {
    return dishes.reduce<Record<string, Dish[]>>((acc, dish) => {
      (acc[dish.category] ??= []).push(dish);
      return acc;
    }, {});
  }, [dishes]);

  function changeBranch(next: string) {
    if (next !== branchId && cart.length) {
      setCart([]);
      setNotice("Cambiaste de sucursal: se vació el carrito anterior para evitar mezclar pedidos.");
    } else setNotice("");
    setDishes([]);
    setLoading(Boolean(next));
    setBranchId(next);
  }

  function addToCart(dish: Dish) {
    if (!branchId || cart.some(item => item.branchId !== branchId)) {
      setNotice("Selecciona una sucursal válida antes de agregar platillos.");
      return;
    }
    if (!dishes.some(item => item.id === dish.id)) return;
    setCart(previous => {
      const found = previous.find(item => item.dishId === dish.id);
      return found
        ? previous.map(item => item.dishId === dish.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...previous, { dishId: dish.id, branchId, quantity: 1 }];
    });
    setNotice(`${dish.name} agregado al carrito de la sucursal seleccionada.`);
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 text-zinc-900 dark:text-zinc-100">
      <header className="mb-8">
        <p className="text-sm font-medium text-violet-600 dark:text-violet-400">Núcleo Digital · Restaurante</p>
        <h1 className="mt-2 text-3xl font-bold">Menú vigente</h1>
        <p className="mt-2 text-zinc-500">Consulta los platillos disponibles y sus precios actuales por sucursal.</p>
      </header>
      <div className="mb-7 rounded-xl border border-zinc-200 p-5 dark:border-zinc-700">
        <label htmlFor="branch" className="mb-2 block font-semibold">Sucursal</label>
        <select id="branch" value={branchId} onChange={event => changeBranch(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-zinc-900 dark:border-zinc-600">
          <option value="">Seleccione sucursal</option>
          {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
        <p className="mt-3 text-sm text-zinc-500">Carrito de esta sucursal: {cart.reduce((sum, item) => sum + item.quantity, 0)} platillos</p>
      </div>
      {notice && <p role="status" className="mb-4 rounded-lg bg-violet-50 p-3 text-sm text-violet-900">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!branchId && <p className="text-zinc-500">Selecciona una sucursal para ver su menú.</p>}
      {loading && <p role="status">Cargando menú…</p>}
      {branchId && !loading && !error && dishes.length === 0 && <p>No hay platillos disponibles en esta sucursal.</p>}
      {!loading && Object.entries(grouped).map(([category, items]) => (
        <section key={category} className="mb-9">
          <h2 className="mb-4 border-b border-zinc-200 pb-2 text-xl font-semibold dark:border-zinc-700">Categoría: {category}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(dish => (
              <article key={dish.id} className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-700">
                <h3 className="text-lg font-semibold">{dish.name}</h3>
                <p className="mt-2 min-h-12 text-sm text-zinc-500">{dish.description || "Sin descripción"}</p>
                <p className="mt-3 text-xl font-bold">${Number(dish.price).toFixed(2)}</p>
                {dish.tags.length > 0 && <p className="mt-2 text-xs text-zinc-500">{dish.tags.join(" · ")}</p>}
                <button type="button" onClick={() => addToCart(dish)}
                  className="mt-4 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800">
                  Agregar al carrito
                </button>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
