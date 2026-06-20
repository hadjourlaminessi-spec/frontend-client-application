import React, { useState } from "react";
import { useCart } from "../../lib/cart";
import { orderService, isRateLimitError } from "../../lib/api";
import CardIcon from "../icons/CardIcon";
import SpinnerIcon from "../icons/SpinnerIcon";
import CrossIcon from "../icons/CrossIcon";
import { AlertIcon, BoxIcon } from "../icons";
import { fmt } from "../../lib/formatters";

interface Props {
  goToOrders: (id?: string) => void;
}

export default function CartPage({ goToOrders }: Props) {
  const { state, dispatch, total, count } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOrder() {
    try {
      setLoading(true);
      setError(null);
      const order = await orderService.createOrder({
        user_id: state.userId,
        products: state.items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          unit_price: i.product.price,
        })),
      });
      dispatch({ type: "CLEAR" });
      goToOrders(order.id);
    } catch (err) {
      if (!isRateLimitError(err)) {
        setError(
          "Erreur lors de la création de la commande. Vérifiez que l'order-service est actif sur le port 8000."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  if (count === 0) {
    return (
      <div>
        <div className="page-header">
          <h1>Panier</h1>
          <p>Vos articles sélectionnés</p>
        </div>
        <div className="empty-state">
          <CardIcon size={48} />
          <h3>Votre panier est vide</h3>
          <p>Ajoutez des produits depuis le catalogue</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Panier</h1>
        <p>
          {count} article{count > 1 ? "s" : ""}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }}>
        {/* Items */}
        <div className="card">
          <div className="card-header">
            <CardIcon size={16} />
            Articles sélectionnés
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Prix unit.</th>
                  <th>Qté</th>
                  <th>Sous-total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((item) => (
                  <tr key={item.product.id}>
                    <td>
                      <div>
                        <p className="fw-600 text-sm" style={{ margin: 0 }}>
                          {item.product.name}
                        </p>
                        <span className="badge badge-secondary text-xs" style={{ marginTop: 4 }}>
                          {item.product.category}
                        </span>
                      </div>
                    </td>
                    <td className="font-mono text-sm">{fmt(item.product.price)}</td>
                    <td>
                      <div className="qty-control">
                        <button
                          className="qty-btn"
                          onClick={() =>
                            dispatch({
                              type: "SET_QTY",
                              id: item.product.id,
                              qty: item.quantity - 1,
                            })
                          }
                        >
                          −
                        </button>
                        <span className="qty-val">{item.quantity}</span>
                        <button
                          className="qty-btn"
                          onClick={() =>
                            dispatch({
                              type: "SET_QTY",
                              id: item.product.id,
                              qty: item.quantity + 1,
                            })
                          }
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="fw-600">{fmt(item.product.price * item.quantity)}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        style={{ color: "var(--destructive)" }}
                        onClick={() => dispatch({ type: "REMOVE", id: item.product.id })}
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

        {/* Summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-header">Récapitulatif</div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {state.items.map((i) => (
                <div key={i.product.id} className="d-flex justify-between align-center">
                  <span className="text-sm text-muted">
                    {i.product.name} × {i.quantity}
                  </span>
                  <span className="text-sm fw-600">{fmt(i.product.price * i.quantity)}</span>
                </div>
              ))}
              <hr className="separator" />
              <div className="d-flex justify-between align-center">
                <span className="fw-600">Total</span>
                <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--foreground)" }}>
                  {fmt(total)}
                </span>
              </div>
              <div className="d-flex justify-between align-center">
                <span className="text-sm text-muted">Livraison</span>
                <span className="text-sm fw-600 text-success">Gratuite</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger">
              <AlertIcon size={16} />
              {error}
            </div>
          )}

          <button
            className="btn btn-primary btn-lg btn-block"
            onClick={handleOrder}
            disabled={loading}
          >
            {loading ? (
              <>
                <SpinnerIcon size={18} />
                Création en cours...
              </>
            ) : (
              <>
                <BoxIcon size={18} />
                Créer la commande
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
