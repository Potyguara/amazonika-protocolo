import {
  useEffect,
  useState,
} from "react";

import { api } from "../../services/api";

type Commission = {
  id: number;

  percent: number;
  baseAmount: number;
  commissionAmount: number;

  status:
    | "PREVISTA"
    | "DISPONIVEL_PARA_PAGAMENTO"
    | "PAGA"
    | "CANCELADA";

  dueDate?: string | null;
  paidAt?: string | null;

  partner: {
    id: number;
    name: string;
    pixKey?: string | null;
  };

  protocol: {
    id: number;
    protocolNumber: string;

    client?: {
      name: string;
    };

    serviceType?: {
      name: string;
    };
  };

  contract?: {
    id: number;
    contractNumber: string;
  } | null;

  financialTransaction?: {
    id: number;
    description: string;
  } | null;
};

type Props = {
  onChanged?: () =>
    void | Promise<void>;
};

function money(value: number) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  ).format(
    Number(value || 0) / 100
  );
}

function statusLabel(
  status: Commission["status"]
) {
  if (
    status ===
    "DISPONIVEL_PARA_PAGAMENTO"
  ) {
    return "Disponível para pagamento";
  }

  if (status === "PREVISTA") {
    return "Prevista";
  }

  if (status === "PAGA") {
    return "Paga";
  }

  return "Cancelada";
}

export default function PartnerCommissionsPanel({
  onChanged,
}: Props) {
  const [items, setItems] =
    useState<Commission[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      const data =
        (await api.partnerCommissions()) as Commission[];

      setItems(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar comissões."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function pay(
    commission: Commission
  ) {
    const confirmed =
      window.confirm(
        `Registrar pagamento de ${money(
          commission.commissionAmount
        )} para ${commission.partner.name}?`
      );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.payPartnerCommission(
        commission.id
      );

      setSuccess(
        "Comissão paga e saída financeira registrada."
      );

      await load();

      if (onChanged) {
        await onChanged();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao pagar comissão."
      );
    } finally {
      setSaving(false);
    }
  }

  const available =
    items.filter(
      (item) =>
        item.status ===
        "DISPONIVEL_PARA_PAGAMENTO"
    );

  const predicted =
    items.filter(
      (item) =>
        item.status === "PREVISTA"
    );

  const paid =
    items.filter(
      (item) =>
        item.status === "PAGA"
    );

  const totalAvailable =
    available.reduce(
      (sum, item) =>
        sum +
        item.commissionAmount,
      0
    );

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h2>Comissões de parceiros</h2>

          <p>
            A comissão é liberada após o
            recebimento da entrada do cliente.
          </p>
        </div>

        <button
          type="button"
          className="secondary-action"
          onClick={load}
        >
          Atualizar
        </button>
      </div>

      {success && (
        <div className="success-panel">
          {success}
        </div>
      )}

      {error && (
        <div className="error-panel">
          {error}
        </div>
      )}

      <div className="metrics-grid three">
        <article className="metric-card">
          <div>
            <span>Previstas</span>
            <strong>
              {predicted.length}
            </strong>
            <small>
              aguardando entrada
            </small>
          </div>
        </article>

        <article className="metric-card">
          <div>
            <span>A pagar</span>
            <strong>
              {money(totalAvailable)}
            </strong>
            <small>
              entrada já recebida
            </small>
          </div>
        </article>

        <article className="metric-card">
          <div>
            <span>Pagas</span>
            <strong>
              {paid.length}
            </strong>
            <small>
              saída registrada
            </small>
          </div>
        </article>
      </div>

      {loading ? (
        <p>
          Carregando comissões...
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Parceiro</th>
                <th>Cliente / Serviço</th>
                <th>Contrato</th>
                <th>Base</th>
                <th>%</th>
                <th>Comissão</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {items.map(
                (item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>
                        {
                          item.partner
                            .name
                        }
                      </strong>

                      {item.partner
                        .pixKey && (
                        <small className="table-small">
                          Pix:{" "}
                          {
                            item.partner
                              .pixKey
                          }
                        </small>
                      )}
                    </td>

                    <td>
                      {item.protocol
                        .client?.name ||
                        "-"}

                      <small className="table-small">
                        {item.protocol
                          .serviceType
                          ?.name ||
                          "-"}
                      </small>
                    </td>

                    <td>
                      {item.contract
                        ?.contractNumber ||
                        "Aguardando"}
                    </td>

                    <td>
                      {money(
                        item.baseAmount
                      )}
                    </td>

                    <td>
                      {item.percent}%
                    </td>

                    <td>
                      <strong>
                        {money(
                          item.commissionAmount
                        )}
                      </strong>
                    </td>

                    <td>
                      {statusLabel(
                        item.status
                      )}
                    </td>

                    <td>
                      {item.status ===
                      "DISPONIVEL_PARA_PAGAMENTO" ? (
                        <button
                          type="button"
                          className="button primary"
                          disabled={saving}
                          onClick={() =>
                            pay(item)
                          }
                        >
                          Pagar comissão
                        </button>
                      ) : item.status ===
                        "PAGA" ? (
                        <span>
                          Pago
                        </span>
                      ) : (
                        <span>
                          Aguardando
                        </span>
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>

          {items.length === 0 && (
            <p>
              Nenhuma comissão cadastrada.
            </p>
          )}
        </div>
      )}
    </article>
  );
}
