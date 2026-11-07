
"use client";

import Link from "next/link";
import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

type Branch = {
  id: string;
  name: string;
};

type Category = {
  id: string;
  name: string;
};

type Dish = {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  category: string;
  categoryId: string;
  tags: string[];
  imageUrl?: string | null;
};

type CartItem = {
  dishId: string;
  branchId: string;
  quantity: number;
};

const DIETS = ["Vegetariano", "Sin gluten"] as const;

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

    case "store":
      return (
        <svg {...props}>
          <path d="M3 10h18l-2-7H5l-2 7Z" />
          <path d="M5 10v11h14V10M9 21v-7h6v7" />
        </svg>
      );

    case "filter":
      return (
        <svg {...props}>
          <path d="M4 5h16M7 12h10M10 19h4" />
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

    case "check":
      return (
        <svg {...props}>
          <path d="m5 12 5 5L20 7" />
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

function money(value: string | number) {
  return `$${Number(value).toFixed(2)}`;
}

function MenuContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branchId, setBranchId] = useState("");

  const [available, setAvailable] = useState<Dish[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searchText, setSearchText] = useState("");

  const selectedCategories = useMemo(
    () =>
      (searchParams.get("category") ?? "")
        .split(",")
        .filter(Boolean),
    [searchParams]
  );

  const selectedDiets = useMemo(
    () =>
      (searchParams.get("tags") ?? "")
        .split(",")
        .filter(Boolean),
    [searchParams]
  );

  const categoryParam = selectedCategories.join(",");
  const dietParam = selectedDiets.join(",");

  // Carga inicial de sucursales y categorías.
  useEffect(() => {
    const controller = new AbortController();

    async function loadInitial() {
      try {
        const [branchesResponse, categoriesResponse] =
          await Promise.all([
            fetch("/api/menu/branches", {
              cache: "no-store",
              signal: controller.signal,
            }),
            fetch("/api/menu/categories", {
              cache: "no-store",
              signal: controller.signal,
            }),
          ]);

        if (!branchesResponse.ok) {
          throw new Error(
            "No se pudieron consultar las sucursales."
          );
        }

        if (!categoriesResponse.ok) {
          throw new Error(
            "No se pudieron consultar las categorías."
          );
        }

        const branchesData: Branch[] =
          await branchesResponse.json();

        const categoriesData: Category[] =
          await categoriesResponse.json();

        if (!controller.signal.aborted) {
          setBranches(branchesData);
          setCategories(categoriesData);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Error al cargar los datos."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingInitial(false);
        }
      }
    }

    void loadInitial();

    return () => controller.abort();
  }, []);

  // Consulta el catálogo completo de la sucursal.
  useEffect(() => {
    if (!branchId) return;

    const controller = new AbortController();

    async function loadMenu() {
      try {
        const response = await fetch(
          `/api/menu/branch/${encodeURIComponent(branchId)}/filter`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            Array.isArray(data.message)
              ? data.message.join(", ")
              : data.message ??
                  "No se pudo consultar el menú."
          );
        }

        if (!Array.isArray(data)) {
          throw new Error("El menú recibido no es válido.");
        }

        if (!controller.signal.aborted) {
          setAvailable(data);
          setError("");
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setAvailable([]);
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar el menú."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadMenu();

    return () => controller.abort();
  }, [branchId]);

  // Filtrado inmediato en memoria (H3).
  const filteredDishes = useMemo(() => {
    const term = searchText.trim().toLowerCase();

    return available.filter((dish) => {
      const matchesCategory =
        selectedCategories.length === 0 ||
        selectedCategories.includes(dish.categoryId);

      const matchesDiet =
        selectedDiets.length === 0 ||
        selectedDiets.some((tag) =>
          dish.tags.includes(tag)
        );

      const matchesSearch =
        !term ||
        dish.name.toLowerCase().includes(term) ||
        (dish.description ?? "")
          .toLowerCase()
          .includes(term) ||
        dish.category.toLowerCase().includes(term);

      return (
        matchesCategory &&
        matchesDiet &&
        matchesSearch
      );
    });
  }, [
    available,
    selectedCategories,
    selectedDiets,
    searchText,
  ]);

  const grouped = useMemo(() => {
    return filteredDishes.reduce<Record<string, Dish[]>>(
      (accumulator, dish) => {
        (accumulator[dish.category] ??= []).push(dish);
        return accumulator;
      },
      {}
    );
  }, [filteredDishes]);

  const totalCartItems = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + item.quantity,
        0
      ),
    [cart]
  );

  function updateFilters(
    categoryIds: string[],
    diets: string[]
  ) {
    const params = new URLSearchParams(
      searchParams.toString()
    );

    if (categoryIds.length) {
      params.set("category", categoryIds.join(","));
    } else {
      params.delete("category");
    }

    if (diets.length) {
      params.set("tags", diets.join(","));
    } else {
      params.delete("tags");
    }

    router.replace(
      `${pathname}${params.size ? `?${params}` : ""}`,
      { scroll: false }
    );
  }

  function changeBranch(next: string) {
    if (next !== branchId && cart.length > 0) {
      setCart([]);
      setNotice(
        "Cambiaste de sucursal. El carrito anterior se vació para evitar mezclar pedidos."
      );
    } else {
      setNotice("");
    }

    setBranchId(next);
    setAvailable([]);
    setSearchText("");
    setError("");
    setLoading(Boolean(next));
    updateFilters([], []);
  }

  function addToCart(dish: Dish) {
    if (
      !branchId ||
      cart.some(
        (item) => item.branchId !== branchId
      )
    ) {
      setNotice(
        "Selecciona una sucursal válida antes de agregar platillos."
      );
      return;
    }

    if (
      !filteredDishes.some(
        (item) => item.id === dish.id
      )
    ) {
      return;
    }

    setCart((previous) => {
      const found = previous.find(
        (item) => item.dishId === dish.id
      );

      return found
        ? previous.map((item) =>
            item.dishId === dish.id
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                }
              : item
          )
        : [
            ...previous,
            {
              dishId: dish.id,
              branchId,
              quantity: 1,
            },
          ];
    });

    setNotice(
      `${dish.name} agregado al carrito de la sucursal seleccionada.`
    );
  }

  const selectedBranch = branches.find(
    (branch) => branch.id === branchId
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
            aria-current="page"
            className="flex shrink-0 items-center gap-3 rounded-xl bg-[#7564e8] px-4 py-3 text-sm font-semibold text-white"
          >
            <Icon name="menu" />
            Consultar menú
          </Link>

          <Link
            href="/cliente/pedido-para-llevar"
            className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <Icon name="bag" />
            Pedido para llevar
          </Link>
        </nav>

        <div className="mt-auto hidden border-t border-white/10 p-5 lg:block">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7564e8] font-semibold">
              N
            </div>

            <div>
              <p className="text-sm font-semibold">
                Núcleo Digital
              </p>
              <p className="text-xs text-slate-400">
                Menú del restaurante
              </p>
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
                Núcleo Digital / Menú
              </p>

              <h1 className="text-3xl font-bold tracking-tight text-[#20233e]">
                Menú vigente
              </h1>

              <p className="mt-2 text-sm text-[#7184a6]">
                Consulta los platillos disponibles y sus precios
                actuales por sucursal.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <Icon name="cart" size={20} />
              <span className="text-sm font-semibold">
                Carrito
              </span>
              <span className="rounded-full bg-[#f0edff] px-2.5 py-1 text-xs font-bold text-[#7564e8]">
                {totalCartItems}
              </span>
            </div>
          </header>

          {/* SELECCIÓN DE SUCURSAL */}
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0edff] text-[#7564e8]">
                <Icon name="store" />
              </div>

              <div>
                <h2 className="text-lg font-bold text-[#20233e]">
                  Seleccionar sucursal
                </h2>
                <p className="text-xs text-slate-400">
                  Consulta el menú disponible en cada sucursal.
                </p>
              </div>
            </div>

            <label
              htmlFor="branch"
              className="block max-w-xl text-sm font-medium text-slate-600"
            >
              Sucursal
              <select
                id="branch"
                value={branchId}
                disabled={loadingInitial}
                onChange={(event) =>
                  changeBranch(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#7564e8]"
              >
                <option value="">
                  {loadingInitial
                    ? "Cargando sucursales..."
                    : "Seleccione sucursal"}
                </option>

                {branches.map((branch) => (
                  <option
                    key={branch.id}
                    value={branch.id}
                  >
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>

            {selectedBranch && (
              <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                <Icon name="check" size={15} />
                Sucursal: {selectedBranch.name}
              </p>
            )}
          </section>

          {/* FILTROS */}
          {branchId && (
            <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0edff] text-[#7564e8]">
                  <Icon name="filter" />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-[#20233e]">
                    Filtrar menú
                  </h2>
                  <p className="text-xs text-slate-400">
                    Encuentra los platillos que buscas.
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <label
                  htmlFor="search-dishes"
                  className="mb-2 block text-sm font-medium text-slate-600"
                >
                  Buscar platillo
                </label>

                <div className="relative max-w-2xl">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icon name="search" size={18} />
                  </span>

                  <input
                    id="search-dishes"
                    type="search"
                    value={searchText}
                    onChange={(event) =>
                      setSearchText(event.target.value)
                    }
                    placeholder="Buscar por nombre, descripción o categoría..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-[#7564e8]"
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-3 text-sm font-bold text-[#252944]">
                    Categorías
                  </h3>

                  <div className="space-y-3">
                    {categories.map((category) => {
                      const enabled = available.some(
                        (dish) =>
                          dish.categoryId === category.id
                      );

                      return (
                        <label
                          key={category.id}
                          className="flex items-center gap-3 text-sm text-slate-600"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(
                              category.id
                            )}
                            disabled={!enabled}
                            onChange={(event) =>
                              updateFilters(
                                event.target.checked
                                  ? [
                                      ...selectedCategories,
                                      category.id,
                                    ]
                                  : selectedCategories.filter(
                                      (id) =>
                                        id !== category.id
                                    ),
                                selectedDiets
                              )
                            }
                            className="h-4 w-4 accent-[#7564e8]"
                          />

                          <span
                            className={
                              enabled
                                ? ""
                                : "text-slate-400"
                            }
                          >
                            {category.name}
                            {!enabled && " (sin disponibles)"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-bold text-[#252944]">
                    Restricciones dietéticas
                  </h3>

                  <div className="space-y-3">
                    {DIETS.map((diet) => {
                      const enabled = available.some(
                        (dish) =>
                          dish.tags.includes(diet)
                      );

                      return (
                        <label
                          key={diet}
                          className="flex items-center gap-3 text-sm text-slate-600"
                        >
                          <input
                            type="checkbox"
                            checked={selectedDiets.includes(
                              diet
                            )}
                            disabled={!enabled}
                            onChange={(event) =>
                              updateFilters(
                                selectedCategories,
                                event.target.checked
                                  ? [
                                      ...selectedDiets,
                                      diet,
                                    ]
                                  : selectedDiets.filter(
                                      (item) =>
                                        item !== diet
                                    )
                              )
                            }
                            className="h-4 w-4 accent-[#7564e8]"
                          />

                          <span
                            className={
                              enabled
                                ? ""
                                : "text-slate-400"
                            }
                          >
                            {diet}
                            {!enabled && " (sin disponibles)"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={
                  selectedCategories.length === 0 &&
                  selectedDiets.length === 0 &&
                  searchText.length === 0
                }
                onClick={() => {
                  setSearchText("");
                  updateFilters([], []);
                }}
                className="mt-6 rounded-lg border border-[#ddd6fe] px-4 py-2 text-sm font-semibold text-[#7564e8] transition hover:bg-[#f0edff] disabled:opacity-40"
              >
                Limpiar filtros
              </button>
            </section>
          )}

          {/* MENSAJES */}
          {notice && (
            <div
              role="status"
              className="mb-5 rounded-xl border border-[#ddd6fe] bg-[#f0edff] p-4 text-sm text-[#5546ba]"
            >
              {notice}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {/* CATÁLOGO */}
          {!branchId ? (
            <section className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0edff] text-[#7564e8]">
                <Icon name="store" size={30} />
              </div>

              <h2 className="text-lg font-bold text-[#20233e]">
                Selecciona una sucursal
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Elige una sucursal para consultar sus
                platillos disponibles.
              </p>
            </section>
          ) : loading ? (
            <section
              role="status"
              className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm"
            >
              <p className="text-sm text-slate-500">
                Cargando menú...
              </p>
            </section>
          ) : filteredDishes.length === 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0edff] text-[#7564e8]">
                <Icon name="search" size={28} />
              </div>

              <h2 className="text-lg font-bold text-[#20233e]">
                No se encontraron platillos
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Prueba con otra categoría, restricción
                dietética o búsqueda.
              </p>
            </section>
          ) : (
            Object.entries(grouped).map(
              ([category, categoryDishes]) => (
                <section
                  key={category}
                  className="mb-8"
                >
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold text-[#20233e]">
                        {category}
                      </h2>

                      <p className="mt-1 text-sm text-slate-400">
                        {categoryDishes.length} platillos
                        disponibles
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {categoryDishes.map((dish) => (
                      <article
                        key={dish.id}
                        className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#c9c1ff] hover:shadow-md"
                      >
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0edff] text-[#7564e8]">
                          <Icon name="menu" size={24} />
                        </div>

                        {dish.imageUrl && <img src={dish.imageUrl} alt={dish.name} className="mb-4 h-44 w-full rounded-xl object-cover" />}
                        <h3 className="text-lg font-bold text-[#252944]">
                          {dish.name}
                        </h3>

                        <p className="mt-3 min-h-12 flex-1 text-sm leading-6 text-slate-500">
                          {dish.description ||
                            "Sin descripción disponible."}
                        </p>

                        {dish.tags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {dish.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-[#f0edff] px-3 py-1 text-xs font-medium text-[#7564e8]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                          <span className="text-xl font-bold text-[#20233e]">
                            {money(dish.price)}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              addToCart(dish)
                            }
                            className="flex items-center gap-2 rounded-xl bg-[#7564e8] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6250d5]"
                          >
                            <Icon name="plus" size={16} />
                            Agregar
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )
            )
          )}

          <footer className="mt-12 border-t border-slate-200 py-5 text-center text-xs text-[#94a3b8]">
            Núcleo Digital · Sistema de gestión de restaurante
          </footer>
        </div>
      </main>
    </div>
  );
}

export default function PublicMenu() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f5f6fb] p-10 text-[#252944]">
          Cargando menú...
        </main>
      }
    >
      <MenuContent />
    </Suspense>
  );
}
