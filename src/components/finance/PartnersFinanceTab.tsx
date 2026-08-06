import { useEffect, useMemo, useState } from "react";
import { api } from "../../services/api";

type Partner = {
  id: number;
  name: string;
  cpfCnpj?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  pixKey?: string | null;
  defaultPercent: number;
  active: boolean;
  notes?: string | null;
};

type PartnerRankingItem = Partner & {
  ranking: number;
  metrics: {
    servicesCount: number;
    contractsAmount: number;
    commissionAmount: number;
    paidCommissionAmount: number;
    pendingCommissionAmount: number;
  };
};

type RankingResponse = {
  period: string;
  totals: {
    partners: number;
    servicesCount: number;
    contractsAmount: number;
    commissionAmount: number;
  };
  ranking: PartnerRankingItem[];
};

type PartnerForm = {
  name: string;
  cpfCnpj: string;
  phone: string;
  whatsapp: string;
  email: string;
  pixKey: string;
  defaultPercent: string;
  active: boolean;
  notes: string;
};

const emptyForm: PartnerForm = {
  name: "",
  cpfCnpj: "",
  phone: "",
  whatsapp: "",
  email: "",
  pixKey: "",
  defaultPercent: "10",
  active: true,
  notes: "",
};

function moneyFromCents(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0) / 100);
}

function periodLabel(period: string) {
  if (period === "month") return "Este mês";
  if (period === "last3months") return "Últimos 3 meses";
  if (period === "year") return "Este ano";
  return "Todo o período";
}

export default function PartnersFinanceTab() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [ranking, setRanking] = useState<RankingResponse | null>(null);

  const [period, setPeriod] = useState("all");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [form, setForm] = useState<PartnerForm>(emptyForm);

  async function loadData(selectedPeriod = period) {
    try {
      setLoading(true);
      setError("");

      const [partnersData, rankingData] = await Promise.all([
        api.partners(true) as Promise<Partner[]>,
        api.partnerRanking(selectedPeriod) as Promise<RankingResponse>,
      ]);

      setPartners(partnersData);
      setRanking(rankingData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar parceiros."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(period);
  }, [period]);

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
  }

  function startNew() {
    resetForm();
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function startEdit(partner: Partner) {
    setEditing(partner);

    setForm({
      name: partner.name || "",
      cpfCnpj: partner.cpfCnpj || "",
      phone: partner.phone || "",
      whatsapp: partner.whatsapp || "",
      email: partner.email || "",
      pixKey: partner.pixKey || "",
      defaultPercent: String(partner.defaultPercent ?? ""),
      active: partner.active,
      notes: partner.notes || "",
    });

    setShowForm(true);
    setError("");
    setSuccess("");
  }

  async function savePartner() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!form.name.trim()) {
        throw new Error("Informe o nome do parceiro.");
      }

      const defaultPercent = Number(
        String(form.defaultPercent).replace(",", ".")
      );

      if (
        !Number.isFinite(defaultPercent) ||
        defaultPercent < 0 ||
        defaultPercent > 100
      ) {
        throw new Error(
          "Informe um percentual entre 0 e 100."
        );
      }

      const payload = {
        name: form.name.trim(),
        cpfCnpj: form.cpfCnpj.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        pixKey: form.pixKey.trim() || null,
        defaultPercent,
        active: form.active,
        notes: form.notes.trim() || null,
      };

      if (editing) {
        await api.updatePartner(editing.id, payload);
        setSuccess("Parceiro atualizado com sucesso.");
      } else {
        await api.createPartner(payload);
        setSuccess("Parceiro cadastrado com sucesso.");
      }

      resetForm();
      setShowForm(false);

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao salvar parceiro."
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePartner(partner: Partner) {
    const action = partner.active ? "inativar" : "ativar";

    if (
      !window.confirm(
        `Deseja ${action} o parceiro "${partner.name}"?`
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.togglePartnerActive(partner.id);

      setSuccess(
        `Parceiro ${partner.active ? "inativado" : "ativado"} com sucesso.`
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao alterar parceiro."
      );
    } finally {
      setSaving(false);
    }
  }

  const rankingMap = useMemo(() => {
    const map = new Map<number, PartnerRankingItem>();

    ranking?.ranking.forEach((item) => {
      map.set(item.id, item);
    });

    return map;
  }, [ranking]);

  const filteredPartners = partners.filter((partner) => {
    const text = [
      partner.name,
      partner.cpfCnpj,
      partner.phone,
      partner.whatsapp,
      partner.email,
      partner.pixKey,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(search.trim().toLowerCase());
  });

  const topThree =
    ranking?.ranking
      .filter((item) => item.metrics.contractsAmount > 0)
      .slice(0, 3) || [];

  return (
    <div className="partners-finance">
      {saving && (
        <div className="modal-backdrop">
          <div className="protocol-modal progress-modal">
            <h2>Processando...</h2>
            <p>Aguarde enquanto o cadastro do parceiro é atualizado.</p>
          </div>
        </div>
      )}

      {success && (
        <div className="panel success-panel">{success}</div>
      )}

      {error && (
        <div className="panel error-panel">{error}</div>
      )}

      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Parceiros e indicações</h2>
            <p>
              Cadastro de parceiros comerciais e desempenho das
              indicações de serviços.
            </p>
          </div>

          <button
            type="button"
            className="button primary"
            onClick={startNew}
          >
            Novo parceiro
          </button>
        </div>

        <div className="form-row">
          <label>
            Buscar parceiro
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome, CPF/CNPJ, telefone ou e-mail"
            />
          </label>

          <label>
            Período do ranking
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            >
              <option value="all">Todo o período</option>
              <option value="month">Este mês</option>
              <option value="last3months">
                Últimos 3 meses
              </option>
              <option value="year">Este ano</option>
            </select>
          </label>

          <button
            type="button"
            className="secondary-action"
            onClick={() => loadData()}
          >
            Atualizar
          </button>
        </div>
      </article>

      {loading && (
        <div className="panel">Carregando parceiros...</div>
      )}

      {!loading && ranking && (
        <>
          <div className="metrics-grid three">
            <article className="metric-card">
              <div>
                <span>Serviços indicados</span>
                <strong>{ranking.totals.servicesCount}</strong>
                <small>{periodLabel(period)}</small>
              </div>
            </article>

            <article className="metric-card">
              <div>
                <span>Montante indicado</span>
                <strong>
                  {moneyFromCents(
                    ranking.totals.contractsAmount
                  )}
                </strong>
                <small>valor total dos contratos</small>
              </div>
            </article>

            <article className="metric-card">
              <div>
                <span>Comissões geradas</span>
                <strong>
                  {moneyFromCents(
                    ranking.totals.commissionAmount
                  )}
                </strong>
                <small>custo comercial acumulado</small>
              </div>
            </article>
          </div>

          <article className="panel">
            <div className="panel-header">
              <div>
                <h2>Ranking de parceiros</h2>
                <p>
                  Classificação pelo valor total dos contratos
                  indicados.
                </p>
              </div>

              <span>{periodLabel(period)}</span>
            </div>

            {topThree.length === 0 ? (
              <p>
                Ainda não existem serviços vinculados a parceiros
                neste período.
              </p>
            ) : (
              <div className="dashboard-grid">
                {topThree.map((item) => (
                  <article
                    className="panel soft-panel"
                    key={item.id}
                  >
                    <span className="eyebrow">
                      {item.ranking}º lugar
                    </span>

                    <h3>{item.name}</h3>

                    <div className="detail-list">
                      <div>
                        <span>Serviços</span>
                        <strong>
                          {item.metrics.servicesCount}
                        </strong>
                      </div>

                      <div>
                        <span>Contratos indicados</span>
                        <strong>
                          {moneyFromCents(
                            item.metrics.contractsAmount
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Comissões</span>
                        <strong>
                          {moneyFromCents(
                            item.metrics.commissionAmount
                          )}
                        </strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>
        </>
      )}

      {showForm && (
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>
                {editing
                  ? "Editar parceiro"
                  : "Cadastrar parceiro"}
              </h2>

              <p>
                O percentual padrão poderá ser alterado
                individualmente em cada serviço indicado.
              </p>
            </div>
          </div>

          <div className="protocol-form-grid">
            <div className="form-section">
              <label>
                Nome *
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                CPF/CNPJ
                <input
                  value={form.cpfCnpj}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      cpfCnpj: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Percentual padrão (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.defaultPercent}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      defaultPercent: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="form-section">
              <label>
                Telefone
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                WhatsApp
                <input
                  value={form.whatsapp}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      whatsapp: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                E-mail
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="form-section">
              <label>
                Chave Pix
                <input
                  value={form.pixKey}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      pixKey: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Situação
                <select
                  value={form.active ? "ATIVO" : "INATIVO"}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      active:
                        event.target.value === "ATIVO",
                    }))
                  }
                >
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                </select>
              </label>
            </div>

            <div className="form-section">
              <label>
                Observações
                <textarea
                  rows={5}
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              className="button primary"
              disabled={saving}
              onClick={savePartner}
            >
              {saving ? "Salvando..." : "Salvar parceiro"}
            </button>
          </div>
        </article>
      )}

      {!loading && (
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Cadastro de parceiros</h2>
              <p>
                Parceiros sem serviços indicados aparecem com
                montante zerado e não interferem nas receitas.
              </p>
            </div>

            <span>
              {filteredPartners.length} parceiro(s)
            </span>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ranking</th>
                  <th>Parceiro</th>
                  <th>% padrão</th>
                  <th>Serviços</th>
                  <th>Montante indicado</th>
                  <th>Comissões</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {filteredPartners.map((partner) => {
                  const rank = rankingMap.get(partner.id);

                  return (
                    <tr key={partner.id}>
                      <td>
                        {rank &&
                        rank.metrics.contractsAmount > 0
                          ? `${rank.ranking}º`
                          : "-"}
                      </td>

                      <td>
                        <strong>{partner.name}</strong>

                        <small className="table-small">
                          {partner.cpfCnpj ||
                            partner.email ||
                            partner.whatsapp ||
                            "Sem documento/contato"}
                        </small>
                      </td>

                      <td>
                        {Number(
                          partner.defaultPercent || 0
                        ).toLocaleString("pt-BR", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                        %
                      </td>

                      <td>
                        {rank?.metrics.servicesCount || 0}
                      </td>

                      <td>
                        {moneyFromCents(
                          rank?.metrics.contractsAmount || 0
                        )}
                      </td>

                      <td>
                        {moneyFromCents(
                          rank?.metrics.commissionAmount || 0
                        )}
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            partner.active
                              ? "payment-pago"
                              : "payment-cancelado"
                          }`}
                        >
                          {partner.active
                            ? "ATIVO"
                            : "INATIVO"}
                        </span>
                      </td>

                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="mini-button"
                            onClick={() =>
                              startEdit(partner)
                            }
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className="mini-button"
                            onClick={() =>
                              togglePartner(partner)
                            }
                          >
                            {partner.active
                              ? "Inativar"
                              : "Ativar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredPartners.length === 0 && (
              <p>Nenhum parceiro encontrado.</p>
            )}
          </div>
        </article>
      )}
    </div>
  );
}
