import React, { useEffect, useState, useCallback } from "react";
import { catalogService, ApiError, isRateLimitError } from "../../lib/api";
import type { Product } from "../../types/api";
import { CATEGORIES } from "../../lib/constants";
import { useCart } from "../../lib/cart";
import SearchIcon from "../icons/SearchIcon";
import CartPlusIcon from "../icons/CartPlusIcon";
import CheckIcon from "../icons/CheckIcon";
import PackageIcon from "../icons/PackageIcon";
import { AlertIcon } from "../icons";
import { fmt } from "../../lib/formatters";

const categoryColors: Record<string, string> = {
  Informatique: "badge-primary",
  Audio: "badge-warning",
  Tablettes: "badge-primary",
  Smartphones: "badge-success",
  Moniteurs: "badge-secondary",
  Périphériques: "badge-secondary",
  Stockage: "badge-warning",
};

function ProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: () => void;
}) {
  const { state } = useCart();
  const inCart = state.items.some((i) => i.product.id === product.id);

  return (
    <div className="card product-card" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Image placeholder */}
      <div
        style={{
          height: 128,
          background: "linear-gradient(135deg, var(--muted) 0%, var(--secondary) 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <PackageIcon size={40} />
        <span
          className={`badge ${categoryColors[product.category] || "badge-secondary"}`}
          style={{
            position: "absolute",
            top: 12,
            left: 12,
          }}
        >
          {product.category}
        </span>
      </div>

      <div className="card-body" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, padding: "1rem" }}>
        <div className="d-flex align-center justify-between">
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground)", lineHeight: 1.4, margin: 0 }}>
            {product.name}
          </h3>
          <span className="text-xs font-mono text-muted" style={{ marginLeft: 8, flexShrink: 0 }}>
            #{product.id.slice(-4).toUpperCase()}
          </span>
        </div>

        {product.description && (
          <p className="text-xs text-muted" style={{ lineHeight: 1.5, margin: 0 }}>
            {product.description}
          </p>
        )}

        {product.stock !== undefined && (
          <p
            className="text-xs d-flex align-center gap-1"
            style={{
              color: product.stock < 10 ? "var(--destructive)" : "var(--muted-foreground)",
              margin: 0,
            }}
          >
            {product.stock < 10 ? (
              <>
                <AlertIcon size={12} /> Plus que {product.stock} en stock
              </>
            ) : (
              <>
                <CheckIcon size={12} /> {product.stock} en stock
              </>
            )}
          </p>
        )}

        <div className="d-flex align-center justify-between" style={{ marginTop: "auto", paddingTop: 12 }}>
          <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--foreground)" }}>
            {fmt(product.price)}
          </span>
          <button
            onClick={onAdd}
            className={inCart ? "btn btn-success btn-sm" : "btn btn-primary btn-sm"}
          >
            {inCart ? (
              <>
                <CheckIcon size={14} /> Ajouté
              </>
            ) : (
              <>
                <CartPlusIcon size={14} /> Ajouter
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="skeleton" style={{ height: 128 }} />
      <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="skeleton" style={{ height: 16, width: "75%" }} />
        <div className="skeleton" style={{ height: 12, width: "100%" }} />
        <div className="skeleton" style={{ height: 12, width: "50%" }} />
        <div className="d-flex justify-between align-center" style={{ paddingTop: 8 }}>
          <div className="skeleton" style={{ height: 24, width: 64 }} />
          <div className="skeleton" style={{ height: 32, width: 80, borderRadius: "var(--radius)" }} />
        </div>
      </div>
    </div>
  );
}

export default function CatalogPage() {
  const { dispatch } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tous");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [errorToasts, setErrorToasts] = useState<Array<{ id: number; msg: string }>>([]);

  function pushErrorToast(message: string, ttl = 4500) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setErrorToasts((s) => [...s, { id, msg: message }]);
    setTimeout(() => {
      setErrorToasts((s) => s.filter((t) => t.id !== id));
    }, ttl);
  }

  const load = useCallback(
    async (q?: string, cat?: string, min?: string, max?: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await catalogService.getProducts({
          name: q || undefined,
          category: cat && cat !== "Tous" ? cat : undefined,
          minPrice: min ? parseFloat(min) : undefined,
          maxPrice: max ? parseFloat(max) : undefined,
        });
        setProducts(data);
      } catch (err: any) {
        if (isRateLimitError(err)) {
          // Handled by global banner
        } else if (err instanceof ApiError && err.payload) {
          const payload = err.payload;
          if (Array.isArray(payload)) {
            payload.forEach((p: any) =>
              pushErrorToast(
                `${p.path || p.location || "field"}: ${p.msg || p.message || JSON.stringify(p)}`
              )
            );
          } else if (payload && typeof payload === "object") {
            if (payload.errors && Array.isArray(payload.errors)) {
              payload.errors.forEach((p: any) =>
                pushErrorToast(
                  `${p.path || p.location || "field"}: ${p.msg || p.message || JSON.stringify(p)}`
                )
              );
            } else if (payload.msg || payload.message) {
              pushErrorToast(payload.msg || payload.message);
            } else {
              pushErrorToast(JSON.stringify(payload));
            }
          } else if (typeof payload === "string") {
            pushErrorToast(payload);
          }
          setError("Le catalog-service a retourné des erreurs. Consultez les notifications.");
        } else {
          setError(
            "Impossible de joindre le catalog-service. Vérifiez que le service est démarré sur le port 4000."
          );
          pushErrorToast("Erreur réseau: impossible de joindre le catalog-service");
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    load(search, category, minPrice, maxPrice);
  }

  function handleAdd(product: Product) {
    dispatch({ type: "ADD", product });
    setToast(`${product.name} ajouté au panier`);
    setTimeout(() => setToast(null), 2500);
  }

  function handleCatChange(cat: string) {
    setCategory(cat);
    load(search, cat, minPrice, maxPrice);
  }

  function handleReset() {
    setSearch("");
    setCategory("Tous");
    setMinPrice("");
    setMaxPrice("");
    load("", "Tous", "", "");
  }

  return (
    <>
      {/* Toast */}
      {(toast || errorToasts.length > 0) && (
        <div className="toast-wrap">
          {toast && (
            <div className="toast toast-success">
              <CheckIcon size={15} />
              {toast}
            </div>
          )}
          {errorToasts.map((t) => (
            <div key={t.id} className="toast toast-error">
              <AlertIcon size={15} />
              {t.msg}
            </div>
          ))}
        </div>
      )}

      {/* Page header */}
      <div className="page-header">
        <h1>Catalogue</h1>
        <p>
          {products.length} produit{products.length !== 1 ? "s" : ""} disponible
          {products.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Search + filters */}
      <div className="card mb-6">
        <div className="card-body">
          <form onSubmit={handleSearch}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
              <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
                <label className="form-label text-xs">Recherche</label>
                <div style={{ position: "relative" }}>
                  <span className="input-icon">
                    <SearchIcon size={16} />
                  </span>
                  <input
                    className="form-control input-with-icon"
                    placeholder="Nom du produit..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ width: 180 }}>
                <label className="form-label text-xs">Catégorie</label>
                <select
                  className="form-control form-select"
                  value={category}
                  onChange={(e) => handleCatChange(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ width: 112 }}>
                <label className="form-label text-xs">Prix min (€)</label>
                <input
                  className="form-control"
                  type="number"
                  placeholder="0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ width: 112 }}>
                <label className="form-label text-xs">Prix max (€)</label>
                <input
                  className="form-control"
                  type="number"
                  placeholder="9999"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary gap-2">
                <SearchIcon size={16} />
                Rechercher
              </button>
              <button type="button" className="btn btn-outline" onClick={handleReset}>
                Réinitialiser
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-danger mb-6">
          <AlertIcon size={16} />
          {error}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <PackageIcon size={48} />
          <h3>Aucun produit trouvé</h3>
          <p>Essayez d'autres critères de recherche</p>
        </div>
      ) : (
        <div className="grid-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onAdd={() => handleAdd(p)} />
          ))}
        </div>
      )}
    </>
  );
}
