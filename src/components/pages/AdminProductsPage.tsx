import React, { useEffect, useState } from "react";
import { catalogService, ApiError, isRateLimitError } from "../../lib/api";
import type { Product, CreateProductPayload } from "../../types/api";
import { CATEGORIES } from "../../lib/constants";
import { AlertIcon, BoxIcon, CrossIcon } from "../icons";
import { hasRole } from "../../services/keycloak";
import { fmt } from "../../lib/formatters";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Informatique");
  const [description, setDescription] = useState("");

  const isAdmin = hasRole("admin");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await catalogService.getProducts();
      setProducts(data);
    } catch (err: any) {
      if (!isRateLimitError(err)) {
        setError("Impossible de charger la liste des produits");
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="page-header">
        <h1>Accès refusé</h1>
        <p>Vous n'avez pas les droits nécessaires pour accéder à cette page.</p>
      </div>
    );
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: CreateProductPayload = {
      name,
      price: parseFloat(price || "0"),
      category,
      description: description || undefined,
    };

    try {
      const created = await catalogService.createProduct(payload);
      setProducts((s) => [created, ...s]);
      setName("");
      setPrice("");
      setCategory("Informatique");
      setDescription("");
    } catch (err: any) {
      if (isRateLimitError(err)) {
        // Handled by global banner
      } else if (err instanceof ApiError && err.payload) {
        setError(
          "Erreur API: " + (err.payload.message || JSON.stringify(err.payload))
        );
      } else {
        setError("Erreur lors de la création du produit");
      }
    }
  }

  async function handleDelete(id: string) {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm("Supprimer ce produit ?")) return;
    try {
      await catalogService.deleteProduct(id);
      setProducts((s) => s.filter((p) => p.id !== id));
    } catch (err: any) {
      if (!isRateLimitError(err)) {
        setError("Erreur lors de la suppression");
        console.error(err);
      }
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Gestion des produits</h1>
        <p>Créer et supprimer des produits</p>
      </div>

      {/* Add product form */}
      <div className="card mb-6">
        <div className="card-header">
          <BoxIcon size={16} />
          Ajouter un produit
        </div>
        <div className="card-body">
          <form onSubmit={handleAdd}>
            <div className="grid-2 mb-4">
              <div className="form-group">
                <label className="form-label text-xs">Nom du produit</label>
                <input
                  className="form-control"
                  placeholder="Nom"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label text-xs">Prix (€)</label>
                <input
                  className="form-control"
                  placeholder="0.00"
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid-2 mb-4">
              <div className="form-group">
                <label className="form-label text-xs">Catégorie</label>
                <select
                  className="form-control form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.filter((c) => c !== "Tous").map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label text-xs">Description (optionnel)</label>
                <input
                  className="form-control"
                  placeholder="Description du produit..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="d-flex gap-2">
              <button className="btn btn-primary" type="submit">
                Ajouter le produit
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setName("");
                  setPrice("");
                  setCategory("Informatique");
                  setDescription("");
                }}
              >
                Réinitialiser
              </button>
            </div>
          </form>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger mb-6">
          <AlertIcon size={16} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="card">
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 48 }} />
            ))}
          </div>
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <BoxIcon size={48} />
          <h3>Aucun produit</h3>
          <p>Ajoutez votre premier produit avec le formulaire ci-dessus</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <BoxIcon size={16} />
            Produits ({products.length})
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                  <th>Prix</th>
                  <th>Catégorie</th>
                  <th>Stock</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <code className="font-mono text-xs text-muted">
                        ...{p.id.slice(-8)}
                      </code>
                    </td>
                    <td className="fw-600">{p.name}</td>
                    <td className="fw-600">{fmt(p.price)}</td>
                    <td>
                      <span className="badge badge-secondary">{p.category}</span>
                    </td>
                    <td className="text-muted">{p.stock ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        style={{ color: "var(--destructive)" }}
                        onClick={() => handleDelete(p.id)}
                        title="Supprimer"
                      >
                        <CrossIcon size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
