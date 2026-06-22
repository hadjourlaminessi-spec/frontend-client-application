import React, { useEffect, useState } from "react";
import {
  orderService,
  paymentService,
  catalogService,
  ApiError,
  isRateLimitError,
  API_CONFIG,
} from "../../lib/api";
import type { Order, Payment } from "../../types/api";
import {
  CheckIcon,
  CrossIcon,
  SpinnerIcon,
  CardIcon,
  ChevronIcon,
  AlertIcon,
  BoxIcon,
} from "../../components/icons";
import { useCart } from "../../lib/cart";
import { fmt, fmtDate } from "../../lib/formatters";

const StatusBadge = ({ status }: { status: Order["status"] }) => {
  const map = {
    CREATED: { cls: "badge-warning", label: "En attente" },
    PAID: { cls: "badge-success", label: "Payée" },
    FAILED: { cls: "badge-danger", label: "Échouée" },
  };
  const { cls, label } = map[status];
  return <span className={`badge ${cls}`}>{label}</span>;
};

interface OrderRowProps {
  order: Order;
  isNew: boolean;
  userId: string;
  productMap?: Record<string, string>;
}

function OrderRow({ order, isNew, userId, productMap }: OrderRowProps) {
  const [paying, setPaying] = useState(false);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(order.status);
  const [open, setOpen] = useState(isNew);

  async function handlePay() {
    try {
      setPaying(true);
      setError(null);
      const p = await paymentService.createPayment({
        order_id: order.id,
        user_id: userId,
        amount: order.total_price,
      });
      setPayment(p);
      const newStatus = p.status === "SUCCESS" ? "PAID" : "FAILED";
      setStatus(newStatus);
      try {
        await orderService.updateOrderStatus(
          order.id,
          newStatus as Order["status"]
        );
      } catch (err) {
        console.error("Failed to persist order status after payment", err);
        setError("Paiement reçu mais impossible de mettre à jour la commande.");
      }
    } catch (err) {
      if (isRateLimitError(err)) {
        // Handled by global banner
      } else if (err instanceof ApiError && err.status === 403) {
        const reason = err.payload?.reason ?? "";
        let msg = "Paiement bloqué par le système de sécurité.";
        if (reason.startsWith("velocity_exceeded")) {
          msg = "Paiement bloqué : trop de tentatives en peu de temps. Veuillez réessayer plus tard.";
        } else if (reason.startsWith("amount_exceeded")) {
          msg = "Paiement bloqué : le montant dépasse la limite autorisée.";
        }
        setError(msg);
      } else {
        const payUrl =
          typeof window !== "undefined" && process.env.NODE_ENV === "development"
            ? "/api/payments"
            : API_CONFIG.PAYMENT;
        setError(`Erreur : payment-service indisponible (${payUrl}).`);
      }
    } finally {
      setPaying(false);
    }
  }

  return (
    <div
      className="card mb-4"
      style={{
        borderLeft: isNew ? "3px solid var(--primary)" : undefined,
      }}
    >
      {/* Order header row */}
      <div
        className="card-header"
        style={{
          cursor: "pointer",
          justifyContent: "space-between",
          userSelect: "none",
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <div className="d-flex align-center gap-3">
          {isNew && <span className="badge badge-primary">Nouvelle</span>}
          <span className="font-mono text-sm text-muted">
            #{order.id.slice(-10).toUpperCase()}
          </span>
          <StatusBadge status={status} />
        </div>
        <div className="d-flex align-center gap-3">
          <span className="text-sm text-muted">{fmtDate(order.created_at)}</span>
          <span style={{ fontWeight: 700, fontSize: "1rem" }}>
            {fmt(order.total_price)}
          </span>
          <ChevronIcon open={open} />
        </div>
      </div>

      {/* Expanded content */}
      {open && (
        <div className="card-body">
          {/* User id */}
          <div className="mb-4">
            <span
              className="text-xs fw-500 text-muted"
              style={{
                textTransform: "uppercase",
                letterSpacing: ".05em",
                marginRight: 8,
              }}
            >
              user_id
            </span>
            <code className="font-mono text-sm text-primary">{order.user_id}</code>
          </div>

          {/* Products table */}
          <div className="table-wrap mb-4">
            <table className="table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Qté</th>
                  <th>Prix unit.</th>
                  <th>Sous-total</th>
                </tr>
              </thead>
              <tbody>
                {order.products.map((p, i) => {
                  const unitPrice =
                    (p as any).unit_price ??
                    (p as any).unitPrice ??
                    p.price ??
                    null;
                  const displayName =
                    p.name ?? productMap?.[p.product_id] ?? p.product_id;
                  return (
                    <tr key={i}>
                      <td className="fw-600">{displayName}</td>
                      <td className="font-mono">{p.quantity}</td>
                      <td className="font-mono">
                        {unitPrice != null ? fmt(unitPrice) : "—"}
                      </td>
                      <td className="fw-700">
                        {unitPrice != null ? fmt(unitPrice * p.quantity) : "—"}
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td
                    colSpan={3}
                    style={{
                      textAlign: "right",
                      fontWeight: 600,
                      paddingRight: 14,
                    }}
                  >
                    Total
                  </td>
                  <td style={{ fontWeight: 700, fontSize: "1rem" }}>
                    {fmt(order.total_price)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payment zone */}
          {payment ? (
            <div
              className={`alert ${
                payment.status === "SUCCESS" ? "alert-success" : "alert-danger"
              }`}
            >
              {payment.status === "SUCCESS" ? (
                <CheckIcon size={16} />
              ) : (
                <CrossIcon size={16} />
              )}
              <div>
                <strong>
                  {payment.status === "SUCCESS"
                    ? "Paiement accepté"
                    : "Paiement refusé"}
                </strong>
                <div className="text-sm" style={{ marginTop: 4 }}>
                  ID paiement : <code className="font-mono">{payment.id}</code>
                  {" · "}
                  Montant : <strong>{fmt(payment.amount)}</strong>
                  {" · "}
                  {fmtDate(payment.created_at)}
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="alert alert-danger mb-3">
              <AlertIcon size={16} />
              {error}
            </div>
          ) : null}

          {status === "CREATED" && !payment && (
            <button
              className="btn btn-success"
              onClick={handlePay}
              disabled={paying}
            >
              {paying ? (
                <>
                  <SpinnerIcon size={16} />
                  Traitement paiement...
                </>
              ) : (
                <>
                  <CardIcon size={16} />
                  Payer {fmt(order.total_price)}
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  highlightOrderId: string | null;
}

export default function OrdersPage({ highlightOrderId }: Props) {
  const { state } = useCart();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalogMap, setCatalogMap] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([orderService.getOrders(), catalogService.getProducts()])
      .then(([ordersRes, products]) => {
        setOrders(ordersRes);
        const map: Record<string, string> = {};
        products.forEach((p) => (map[p.id] = p.name));
        setCatalogMap(map);
      })
      .catch((err) => {
        if (!isRateLimitError(err)) {
          setError(
            "Impossible de charger les commandes. Vérifiez que l'order-service est actif."
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const pending = orders.filter((o) => o.status === "CREATED").length;
  const paid = orders.filter((o) => o.status === "PAID").length;
  const failed = orders.filter((o) => o.status === "FAILED").length;

  return (
    <div>
      <div className="page-header">
        <h1>Commandes</h1>
        <p>
          {orders.length} commande{orders.length !== 1 ? "s" : ""}
        </p>
      </div>

      {orders.length > 0 && (
        <div className="grid-3 mb-6">
          {[
            { label: "En attente", value: pending, cls: "text-muted" },
            { label: "Payées", value: paid, cls: "text-success" },
            { label: "Échouées", value: failed, cls: "text-destructive" },
          ].map((s) => (
            <div className="card stat-card" key={s.label}>
              <div className="stat-label">{s.label}</div>
              <div className={`stat-value ${s.cls}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="alert alert-danger mb-6">
          <AlertIcon size={16} />
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <div className="card" key={i}>
              <div className="card-header">
                <div className="skeleton" style={{ height: 20, width: "60%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <BoxIcon size={48} />
          <h3>Aucune commande</h3>
          <p>Ajoutez des produits au panier et créez votre première commande</p>
        </div>
      ) : (
        <div>
          {orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              isNew={order.id === highlightOrderId}
              userId={state.userId}
              productMap={catalogMap}
            />
          ))}
        </div>
      )}
    </div>
  );
}
