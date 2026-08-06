import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { api } from "../../services/api";

type Partner = {
  id: number;
  name: string;
  defaultPercent: number;
  active: boolean;
};

type Referral = {
  id: number;
  partnerId: number;
  protocolId: number;
  contractId?: number | null;

  percent: number;

  baseAmount: number;
  commissionAmount: number;

  status: string;

  partner: {
    id: number;
    name: string;
    defaultPercent: number;
  };

  contract?: {
    id: number;
    contractNumber: string;
    status: string;
  } | null;
};

type Props = {
  protocol: any;
  onReload?: () => void | Promise<void>;
};

function money(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0) / 100);
}

export default function PartnerReferralPanel({
  protocol,
  onReload,
}: Props) {
  const [partners, setPartners] =
    useState<Partner[]>([]);

  const [referral, setReferral] =
    useState<Referral | null>(null);

  const [hasPartner, setHasPartner] =
    useState(false);

  const [partnerId, setPartnerId] =
    useState("");

  const [percent, setPercent] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [editing, setEditing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const contractSignature = useMemo(
    () =>
      (protocol?.contracts || [])
        .map(
          (contract: any) =>
            `${contract.id}:${contract.status}:${contract.contractValue}`
        )
        .join("|"),
    [protocol?.contracts]
  );

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [partnersData, referralData] =
        await Promise.all([
          api.partners() as Promise<Partner[]>,

          api.partnerReferral(
            protocol.id
          ) as Promise<{
            hasPartner: boolean;
            referral: Referral | null;
          }>,
        ]);

      setPartners(partnersData);

      setReferral(
        referralData.referral || null
      );

      setHasPartner(
        Boolean(
          referralData.hasPartner &&
          referralData.referral
        )
      );

      if (referralData.referral) {
        setPartnerId(
          String(
            referralData.referral.partnerId
          )
        );

        setPercent(
          String(
            referralData.referral.percent
          )
        );
      } else {
        setPartnerId("");
        setPercent("");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar indicação."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [
    protocol.id,
    contractSignature,
  ]);

  const selectedPartner =
    partners.find(
      (item) =>
        String(item.id) === partnerId
    );

  function selectPartner(
    value: string
  ) {
    setPartnerId(value);

    const partner =
      partners.find(
        (item) =>
          String(item.id) === value
      );

    if (partner) {
      setPercent(
        String(partner.defaultPercent)
      );
    } else {
      setPercent("");
    }
  }

  async function save() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!partnerId) {
        throw new Error(
          "Selecione o parceiro."
        );
      }

      const parsedPercent =
        Number(
          String(percent).replace(
            ",",
            "."
          )
        );

      if (
        !Number.isFinite(
          parsedPercent
        ) ||
        parsedPercent < 0 ||
        parsedPercent > 100
      ) {
        throw new Error(
          "Informe um percentual válido entre 0 e 100."
        );
      }

      await api.savePartnerReferral(
        protocol.id,
        {
          partnerId:
            Number(partnerId),

          percent:
            parsedPercent,
        }
      );

      setSuccess(
        "Indicação salva com sucesso."
      );

      setEditing(false);

      await loadData();

      if (onReload) {
        await onReload();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao salvar indicação."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeReferral() {
    const confirmed =
      window.confirm(
        "Remover a indicação deste serviço?"
      );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.removePartnerReferral(
        protocol.id
      );

      setSuccess(
        "Indicação removida com sucesso."
      );

      setReferral(null);
      setHasPartner(false);
      setPartnerId("");
      setPercent("");
      setEditing(false);

      if (onReload) {
        await onReload();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao remover indicação."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <article className="panel">
        Carregando indicação comercial...
      </article>
    );
  }

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">
            Comercial
          </span>

          <h2>
            Indicação de parceiro
          </h2>

          <p>
            Informe somente quando este
            serviço tiver sido indicado
            por um parceiro comercial.
          </p>
        </div>

        {!editing && (
          <button
            type="button"
            className="secondary-action"
            onClick={() =>
              setEditing(true)
            }
          >
            {hasPartner
              ? "Alterar indicação"
              : "Informar parceiro"}
          </button>
        )}
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

      {!editing &&
        !hasPartner && (
          <div className="detail-list">
            <div>
              <span>
                Origem do serviço
              </span>

              <strong>
                Sem indicação de parceiro
              </strong>
            </div>

            <div>
              <span>
                Comissão
              </span>

              <strong>
                Não aplicável
              </strong>
            </div>
          </div>
        )}

      {!editing &&
        hasPartner &&
        referral && (
          <>
            <div className="detail-list">
              <div>
                <span>
                  Parceiro
                </span>

                <strong>
                  {referral.partner.name}
                </strong>
              </div>

              <div>
                <span>
                  Percentual deste serviço
                </span>

                <strong>
                  {Number(
                    referral.percent
                  ).toLocaleString(
                    "pt-BR",
                    {
                      maximumFractionDigits: 2,
                    }
                  )}
                  %
                </strong>
              </div>

              <div>
                <span>
                  Contrato vinculado
                </span>

                <strong>
                  {referral.contract
                    ?.contractNumber ||
                    "Aguardando contrato"}
                </strong>
              </div>

              <div>
                <span>
                  Valor-base
                </span>

                <strong>
                  {referral.contractId
                    ? money(
                        referral.baseAmount
                      )
                    : "Aguardando contrato"}
                </strong>
              </div>

              <div>
                <span>
                  Comissão prevista
                </span>

                <strong>
                  {referral.contractId
                    ? money(
                        referral.commissionAmount
                      )
                    : "Aguardando contrato"}
                </strong>
              </div>

              <div>
                <span>Status</span>

                <strong>
                  {referral.status}
                </strong>
              </div>
            </div>

            {referral.status !==
              "PAGA" && (
              <div className="form-actions">
                <button
                  type="button"
                  className="mini-button danger"
                  onClick={
                    removeReferral
                  }
                  disabled={saving}
                >
                  Remover indicação
                </button>
              </div>
            )}
          </>
        )}

      {editing && (
        <>
          <div className="protocol-form-grid">
            <div className="form-section">
              <label>
                Este serviço foi indicado por
                <select
                  value={partnerId}
                  onChange={(event) =>
                    selectPartner(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Selecione o parceiro
                  </option>

                  {partners.map(
                    (partner) => (
                      <option
                        key={partner.id}
                        value={partner.id}
                      >
                        {partner.name}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>

            <div className="form-section">
              <label>
                Percentual deste serviço (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={percent}
                  onChange={(event) =>
                    setPercent(
                      event.target.value
                    )
                  }
                />
              </label>

              {selectedPartner && (
                <small>
                  Percentual padrão de{" "}
                  {selectedPartner.name}:{" "}
                  {selectedPartner.defaultPercent}%
                </small>
              )}
            </div>
          </div>

          <p>
            O percentual gravado neste serviço
            ficará independente de futuras
            alterações no cadastro do parceiro.
          </p>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-action"
              disabled={saving}
              onClick={() => {
                setEditing(false);

                if (referral) {
                  setPartnerId(
                    String(
                      referral.partnerId
                    )
                  );

                  setPercent(
                    String(
                      referral.percent
                    )
                  );
                } else {
                  setPartnerId("");
                  setPercent("");
                }
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              className="button primary"
              disabled={saving}
              onClick={save}
            >
              {saving
                ? "Salvando..."
                : "Salvar indicação"}
            </button>
          </div>
        </>
      )}
    </article>
  );
}
