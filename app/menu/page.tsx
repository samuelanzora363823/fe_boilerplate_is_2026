"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Branch = { id: string; name: string };
type Category = { id: string; name: string };
type Dish = { id: string; name: string; description: string | null; price: string | number; category: string; categoryId: string; tags: string[] };
type CartItem = { dishId: string; branchId: string; quantity: number };
const DIETS = ["Vegetariano", "Sin gluten"] as const;

function MenuContent() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branchId, setBranchId] = useState("");
  const [available, setAvailable] = useState<Dish[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selectedCategories = useMemo(() => (search.get("category") ?? "").split(",").filter(Boolean), [search]);
  const selectedDiets = useMemo(() => (search.get("tags") ?? "").split(",").filter(Boolean), [search]);
  const categoryParam = selectedCategories.join(",");
  const dietParam = selectedDiets.join(",");

  useEffect(() => {
    Promise.all([
      fetch("/api/menu/branches", { cache: "no-store" }).then(async r => { if (!r.ok) throw new Error("No se pudieron consultar las sucursales"); return r.json() as Promise<Branch[]>; }),
      fetch("/api/menu/categories", { cache: "no-store" }).then(async r => { if (!r.ok) throw new Error("No se pudieron consultar las categorías"); return r.json() as Promise<Category[]>; }),
    ]).then(([b, c]) => { setBranches(b); setCategories(c); }).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!branchId) { setAvailable([]); setDishes([]); return; }
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/menu/branch/${branchId}/filter`, { cache: "no-store", signal: controller.signal })
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.message ?? "No se pudo consultar el menú"); return data as Dish[]; })
      .then(data => { setAvailable(data); setError(""); })
      .catch((e: Error) => { if (e.name !== "AbortError") { setAvailable([]); setError(e.message); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [branchId]);

  // Filtrado inmediato en memoria (<1s) y validación de resultados con el endpoint H3.
  useEffect(() => {
    const matching = available.filter(d =>
      (!selectedCategories.length || selectedCategories.includes(d.categoryId)) &&
      (!selectedDiets.length || selectedDiets.some(tag => d.tags.includes(tag)))
    );
    setDishes(matching);
    if (!branchId || !available.length) return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (categoryParam) params.set("category", categoryParam);
    if (dietParam) params.set("tags", dietParam);
    fetch(`/api/menu/branch/${branchId}/filter?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.message ?? "Error al filtrar"); return data as Dish[]; })
      .then(data => { if (!controller.signal.aborted) { setDishes(data); setError(""); } })
      .catch((e: Error) => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, [branchId, available, categoryParam, dietParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => dishes.reduce<Record<string, Dish[]>>((acc, dish) => {
    (acc[dish.category] ??= []).push(dish);
    return acc;
  }, {}), [dishes]);

  function updateFilters(categoryIds: string[], diets: string[]) {
    const params = new URLSearchParams(search.toString());
    if (categoryIds.length) params.set("category", categoryIds.join(",")); else params.delete("category");
    if (diets.length) params.set("tags", diets.join(",")); else params.delete("tags");
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  function changeBranch(next: string) {
    if (next !== branchId && cart.length) {
      setCart([]);
      setNotice("Cambiaste de sucursal: se vació el carrito anterior para evitar mezclar pedidos.");
    } else setNotice("");
    setBranchId(next);
    setAvailable([]);
    setDishes([]);
    updateFilters([], []);
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
      {branchId && <fieldset className="mb-7 rounded-xl border border-zinc-200 p-5 dark:border-zinc-700">
        <legend className="px-2 font-semibold">Filtrar menú</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><p className="mb-2 font-medium">Categorías</p>
            {categories.map(category => {
              const enabled = available.some(d => d.categoryId === category.id);
              return <label key={category.id} className="mb-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selectedCategories.includes(category.id)} disabled={!enabled}
                  onChange={e => updateFilters(e.target.checked ? [...selectedCategories, category.id] : selectedCategories.filter(x => x !== category.id), selectedDiets)} />
                <span className={!enabled ? "text-zinc-500" : ""}>{category.name}{!enabled ? " (sin disponibles)" : ""}</span>
              </label>;
            })}
          </div>
          <div><p className="mb-2 font-medium">Restricciones dietéticas</p>
            {DIETS.map(diet => {
              const enabled = available.some(d => d.tags.includes(diet));
              return <label key={diet} className="mb-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selectedDiets.includes(diet)} disabled={!enabled}
                  onChange={e => updateFilters(selectedCategories, e.target.checked ? [...selectedDiets, diet] : selectedDiets.filter(x => x !== diet))} />
                <span className={!enabled ? "text-zinc-500" : ""}>{diet}{!enabled ? " (sin disponibles)" : ""}</span>
              </label>;
            })}
          </div>
        </div>
        <button type="button" className="mt-3 text-sm font-medium text-violet-600 underline disabled:text-zinc-500" disabled={!selectedCategories.length && !selectedDiets.length} onClick={() => updateFilters([], [])}>Limpiar filtros</button>
      </fieldset>}
      {notice && <p role="status" className="mb-4 rounded-lg bg-violet-50 p-3 text-sm text-violet-900">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!branchId && <p className="text-zinc-500">Selecciona una sucursal para ver su menú.</p>}
      {loading && <p role="status">Cargando menú…</p>}
      {branchId && !loading && !error && dishes.length === 0 && <p>No hay platillos que coincidan con los filtros seleccionados.</p>}
      {!loading && Object.entries(grouped).map(([category, items]) => (
        <section key={category} className="mb-9">
          <h2 className="mb-4 border-b border-zinc-200 pb-2 text-xl font-semibold dark:border-zinc-700">Categoría: {category}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(dish => <article key={dish.id} className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-700">
              <h3 className="text-lg font-semibold">{dish.name}</h3>
              <p className="mt-2 min-h-12 text-sm text-zinc-500">{dish.description || "Sin descripción"}</p>
              <p className="mt-3 text-xl font-bold">${Number(dish.price).toFixed(2)}</p>
              {dish.tags.length > 0 && <p className="mt-2 text-xs text-zinc-500">{dish.tags.join(" · ")}</p>}
              <button type="button" onClick={() => addToCart(dish)} className="mt-4 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800">Agregar al carrito</button>
            </article>)}
          </div>
        </section>
      ))}
    </main>
  );
}

export default function PublicMenu() {
  return <Suspense fallback={<main className="p-10">Cargando menú…</main>}><MenuContent /></Suspense>;
}
