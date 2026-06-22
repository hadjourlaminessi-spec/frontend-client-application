import React, { useEffect, useState } from "react";
import { paymentService, isRateLimitError, API_CONFIG } from "../../lib/api";
import {
  AlertIcon,
  CreditIcon,
  CheckIcon,
  CrossIcon,
} from "../../components/icons";
import { Payment } from "../../types/api";
import { fmt, fmtDate } from "../../lib/formatters";

export default function PaymentPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    paymentService
      .getPayments()
      .then(setPayments)
      .catch((err) => {
        if (!isRateLimitError(err)) {
          const payUrl =
            typeof window !== "undefined" &&
            process.env.NODE_ENV === "development"
              ? "/api/payments"
              : API_CONFIG.PAYMENT;
          setError(
            `Impossible de charger les paiements. Vérifiez que le payment-service est actif (${payUrl}).`
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const success = payments.filter((p) => p.status === "SUCCESS");
  const failed = payments.filter((p) => p.status === "FAILED");
  const volume = success.reduce((s, p) => s + p.amount, 0);
  const rate =
    payments.length > 0
      ? Math.round((success.length / payments.length) * 100)
      : 0;

  return (
    <div>
      <div className="page-header">
        <h1>Historique des paiements</h1>
        <p>
          {payments.length} transaction{payments.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Simulation notice */}
      <div className="alert alert-info mb-6">
        <AlertIcon size={16} />
        <div>
          <strong>Mode simulation</strong> — Le payment-service retourne{" "}
          <code className="font-mono">SUCCESS</code> avec une probabilité de 80% et{" "}
          <code className="font-mono">FAILED</code> avec 20%.
        </div>
      </div>

      {/* Stats */}
      {payments.length > 0 && (
        <div className="grid-4 mb-6">
          {[
            {
              label: "Transactions",
              value: payments.length,
              sub: "total",
              cls: "",
            },
            {
              label: "Acceptées",
              value: success.length,
              sub: `${rate}% de succès`,
              cls: "text-success",
            },
            {
              label: "Refusées",
              value: failed.length,
              sub: `${100 - rate}% d'échec`,
              cls: "text-destructive",
            },
            {
              label: "Volume traité",
              value: fmt(volume),
              sub: "paiements acceptés",
              cls: "text-primary",
            },
          ].map((s) => (
            <div className="card stat-card" key={s.label}>
              <div className="stat-label">{s.label}</div>
              <div
                className={`stat-value ${s.cls}`}
                style={{ fontSize: typeof s.value === "string" ? "1.25rem" : "1.75rem" }}
              >
                {s.value}
              </div>
              <div className="stat-sub">{s.sub}</div>
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
        <div className="card">
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: 40 }} />
            ))}
          </div>
        </div>
      ) : payments.length === 0 ? (
        <div className="empty-state">
          <CreditIcon size={48} />
          <h3>Aucun paiement</h3>
          <p>Les paiements s'afficheront ici après avoir traité des commandes</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <CreditIcon size={16} />
            Transactions ({payments.length})
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID Paiement</th>
                  <th>Commande</th>
                  <th>User</th>
                  <th>Date</th>
                  <th>Montant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <code className="font-mono text-xs text-muted">{p.id}</code>
                    </td>
                    <td>
                      <code className="font-mono text-xs text-primary">
                        ...{p.order_id.slice(-10).toUpperCase()}
                      </code>
                    </td>
                    <td className="text-sm text-muted font-mono">{p.user_id}</td>
                    <td className="text-sm text-muted">{fmtDate(p.created_at)}</td>
                    <td className="fw-700">{fmt(p.amount)}</td>
                    <td>
                      {p.status === "SUCCESS" ? (
                        <span className="badge badge-success">
                          <CheckIcon size={10} /> SUCCESS
                        </span>
                      ) : (
                        <span className="badge badge-danger">
                          <CrossIcon size={10} /> FAILED
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-footer">
            <span className="text-xs text-muted">
              Volume total accepté : <strong>{fmt(volume)}</strong>
              {" · "}
              Taux de succès : <strong>{rate}%</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
