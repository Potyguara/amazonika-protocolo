import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Edit3,
  Layers3,
  Package,
  Plus,
  Search,
  Tags,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import "./CatalogPage.css";

type PricingMode =
  | "FIXO"
  | "POR_HECTARE"
  | "POR_KM"
  | "POR_UNIDADE"
  | "POR_MODULO_FISCAL"
  | "POR_DIARIA"
  | "POR_HORA"
  | "POR_FAIXA"
  | "SOB_CONSULTA";

type CatalogCategory = {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  sortOrder: number;
  active: boolean;
  _count?: {
    services: number;
  };
};

type PricingTier = {
  id?: number;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  unitAmount: number;
  minimumAmount?: number | null;
  sortOrder?: number;
  active?: boolean;
};

type CatalogService = {
  id: number;
  categoryId: number;
  code: string;
  name: string;
  acronym?: string | null;
  shortDescription?: string | null;
  proposalDescription?: string | null;
  technicalDescription?: string | null;
  legalText?: string | null;
  pricingMode: PricingMode;
  baseAmount: number;
  minimumAmount?: number | null;
  unitLabel?: string | null;
  defaultExecutionDays?: number | null;
  allowManualPrice: boolean;
  sortOrder: number;
  active: boolean;
  category: CatalogCategory;
  pricingTiers?: PricingTier[];
};

type CatalogSummary = {
  categories: number;
  activeCategories: number;
  services: number;
  activeServices: number;
  packages: number;
  activePackages: number;
};

const pricingLabels: Record<PricingMode, string> = {
  FIXO: "Valor fixo",
  POR_HECTARE: "Por hectare",
  POR_KM: "Por quilômetro",
  POR_UNIDADE: "Por unidade",
  POR_MODULO_FISCAL: "Por módulo fiscal",
  POR_DIARIA: "Por diária",
  POR_HORA: "Por hora",
  POR_FAIXA: "Por faixa",
  SOB_CONSULTA: "Sob consulta",
};

const unitSuggestions: Partial<Record<PricingMode, string>> = {
  FIXO: "Serviço",
  POR_HECTARE: "ha",
  POR_KM: "km",
  POR_UNIDADE: "unidade",
  POR_MODULO_FISCAL: "módulo fiscal",
  POR_DIARIA: "diária",
  POR_HORA: "hora",
};

function moneyFromCents(value?: number | null) {
  return (Number(value ?? 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function reaisToCents(value: string) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return 0;
  }

  // Aceita: 8000 | 8000,00 | 8.000 | 8.000,00
  const normalized = raw
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}

function centsToInput(value?: number | null) {
  if (value === null || value === undefined) {
    return "";
  }

  return (Number(value) / 100)
    .toFixed(2)
    .replace(".", ",");
}

function blankService() {
  return {
    categoryId: "",
    code: "",
    name: "",
    acronym: "",
    shortDescription: "",
    proposalDescription: "",
    technicalDescription: "",
    legalText: "",
    pricingMode: "FIXO" as PricingMode,
    baseAmount: "",
    minimumAmount: "",
    unitLabel: "Serviço",
    defaultExecutionDays: "",
    allowManualPrice: true,
    sortOrder: "0",
    active: true,
  };
}

export default function CatalogPage() {
  const [summary, setSummary] = useState<CatalogSummary | null>(null);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(
    new Set()
  );

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<CatalogCategory | null>(null);

  const [categoryName, setCategoryName] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryActive, setCategoryActive] = useState(true);

  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingService, setEditingService] =
    useState<CatalogService | null>(null);

  const [serviceForm, setServiceForm] = useState(blankService());
  const [pricingTiers, setPricingTiers] = useState<
    Array<{
      minQuantity: string;
      maxQuantity: string;
      unitAmount: string;
      minimumAmount: string;
    }>
  >([]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [summaryData, categoriesData, servicesData] = await Promise.all([
        api.catalogSummary() as Promise<CatalogSummary>,
        api.catalogCategories(true) as Promise<CatalogCategory[]>,
        api.catalogServices({
          includeInactive: true,
        }) as Promise<CatalogService[]>,
      ]);

      setSummary(summaryData);
      setCategories(categoriesData);
      setServices(servicesData);

      setExpandedCategories(
        new Set(categoriesData.filter((item) => item.active).map((item) => item.id))
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar catálogo técnico-comercial."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return services.filter((service) => {
      const matchesCategory =
        !categoryFilter ||
        String(service.categoryId) === categoryFilter;

      const matchesSearch =
        !query ||
        service.name.toLowerCase().includes(query) ||
        service.code.toLowerCase().includes(query) ||
        String(service.acronym || "")
          .toLowerCase()
          .includes(query) ||
        String(service.shortDescription || "")
          .toLowerCase()
          .includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [services, search, categoryFilter]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function resetCategoryForm() {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryCode("");
    setCategoryDescription("");
    setCategoryActive(true);
  }

  function openNewCategory() {
    clearMessages();
    resetCategoryForm();
    setShowCategoryForm(true);
  }

  function editCategory(item: CatalogCategory) {
    clearMessages();
    setEditingCategory(item);
    setCategoryName(item.name || "");
    setCategoryCode(item.code || "");
    setCategoryDescription(item.description || "");
    setCategoryActive(item.active);
    setShowCategoryForm(true);
  }

  async function saveCategory() {
    try {
      clearMessages();

      if (!categoryName.trim()) {
        throw new Error("Informe o nome da categoria.");
      }

      setSaving(true);

      const payload = {
        name: categoryName.trim(),
        code: categoryCode.trim() || undefined,
        description: categoryDescription.trim() || null,
        active: categoryActive,
      };

      if (editingCategory) {
        await api.updateCatalogCategory(
          editingCategory.id,
          payload
        );

        setSuccess("Categoria atualizada com sucesso.");
      } else {
        await api.createCatalogCategory(payload);
        setSuccess("Categoria cadastrada com sucesso.");
      }

      setShowCategoryForm(false);
      resetCategoryForm();
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao salvar categoria."
      );
    } finally {
      setSaving(false);
    }
  }

  function resetServiceForm() {
    setEditingService(null);
    setServiceForm(blankService());
    setPricingTiers([]);
  }

  function openNewService() {
    clearMessages();
    resetServiceForm();

    if (categories.length > 0) {
      setServiceForm((current) => ({
        ...current,
        categoryId: String(
          categories.find((item) => item.active)?.id ||
            categories[0].id
        ),
      }));
    }

    setShowServiceForm(true);
  }

  function editService(item: CatalogService) {
    clearMessages();
    setEditingService(item);

    setServiceForm({
      categoryId: String(item.categoryId),
      code: item.code || "",
      name: item.name || "",
      acronym: item.acronym || "",
      shortDescription: item.shortDescription || "",
      proposalDescription: item.proposalDescription || "",
      technicalDescription: item.technicalDescription || "",
      legalText: item.legalText || "",
      pricingMode: item.pricingMode,
      baseAmount: centsToInput(item.baseAmount),
      minimumAmount: centsToInput(item.minimumAmount),
      unitLabel: item.unitLabel || "",
      defaultExecutionDays: item.defaultExecutionDays
        ? String(item.defaultExecutionDays)
        : "",
      allowManualPrice: item.allowManualPrice,
      sortOrder: String(item.sortOrder || 0),
      active: item.active,
    });

    setPricingTiers(
      (item.pricingTiers || []).map((tier) => ({
        minQuantity:
          tier.minQuantity !== null &&
          tier.minQuantity !== undefined
            ? String(tier.minQuantity)
            : "",
        maxQuantity:
          tier.maxQuantity !== null &&
          tier.maxQuantity !== undefined
            ? String(tier.maxQuantity)
            : "",
        unitAmount: centsToInput(tier.unitAmount),
        minimumAmount: centsToInput(tier.minimumAmount),
      }))
    );

    setShowServiceForm(true);
  }

  function setPricingMode(mode: PricingMode) {
    setServiceForm((current) => ({
      ...current,
      pricingMode: mode,
      unitLabel:
        current.unitLabel ||
        unitSuggestions[mode] ||
        "",
    }));

    if (mode === "POR_FAIXA" && pricingTiers.length === 0) {
      setPricingTiers([
        {
          minQuantity: "",
          maxQuantity: "",
          unitAmount: "",
          minimumAmount: "",
        },
      ]);
    }
  }

  function addPricingTier() {
    setPricingTiers((current) => [
      ...current,
      {
        minQuantity: "",
        maxQuantity: "",
        unitAmount: "",
        minimumAmount: "",
      },
    ]);
  }

  function removePricingTier(index: number) {
    setPricingTiers((current) =>
      current.filter((_, currentIndex) => currentIndex !== index)
    );
  }

  async function saveService() {
    try {
      clearMessages();

      if (!serviceForm.categoryId) {
        throw new Error("Selecione a categoria.");
      }

      if (!serviceForm.name.trim()) {
        throw new Error("Informe o nome do serviço.");
      }

      if (
        serviceForm.pricingMode !== "SOB_CONSULTA" &&
        serviceForm.pricingMode !== "POR_FAIXA" &&
        reaisToCents(serviceForm.baseAmount) <= 0
      ) {
        throw new Error(
          "Informe o valor do serviço ou altere a modalidade para Sob consulta."
        );
      }

      if (
        serviceForm.pricingMode === "POR_FAIXA" &&
        pricingTiers.length === 0
      ) {
        throw new Error("Cadastre ao menos uma faixa de preço.");
      }

      setSaving(true);

      const payload = {
        categoryId: Number(serviceForm.categoryId),
        code: serviceForm.code.trim() || undefined,
        name: serviceForm.name.trim(),
        acronym: serviceForm.acronym.trim() || null,
        shortDescription:
          serviceForm.shortDescription.trim() || null,
        proposalDescription:
          serviceForm.proposalDescription.trim() || null,
        technicalDescription:
          serviceForm.technicalDescription.trim() || null,
        legalText: serviceForm.legalText.trim() || null,
        pricingMode: serviceForm.pricingMode,
        baseAmount:
          serviceForm.pricingMode === "SOB_CONSULTA" ||
          serviceForm.pricingMode === "POR_FAIXA"
            ? 0
            : reaisToCents(serviceForm.baseAmount),
        minimumAmount: serviceForm.minimumAmount
          ? reaisToCents(serviceForm.minimumAmount)
          : null,
        unitLabel: serviceForm.unitLabel.trim() || null,
        defaultExecutionDays:
          serviceForm.defaultExecutionDays
            ? Number(serviceForm.defaultExecutionDays)
            : null,
        allowManualPrice: serviceForm.allowManualPrice,
        sortOrder: Number(serviceForm.sortOrder || 0),
        active: serviceForm.active,
      };

      let saved: CatalogService;

      if (editingService) {
        saved = (await api.updateCatalogService(
          editingService.id,
          payload
        )) as CatalogService;
      } else {
        saved = (await api.createCatalogService(
          payload
        )) as CatalogService;
      }

      if (serviceForm.pricingMode === "POR_FAIXA") {
        await api.updateCatalogPricingTiers(
          saved.id,
          pricingTiers.map((tier, index) => ({
            minQuantity: tier.minQuantity
              ? Number(tier.minQuantity)
              : null,
            maxQuantity: tier.maxQuantity
              ? Number(tier.maxQuantity)
              : null,
            unitAmount: reaisToCents(tier.unitAmount),
            minimumAmount: tier.minimumAmount
              ? reaisToCents(tier.minimumAmount)
              : null,
            sortOrder: index,
            active: true,
          }))
        );
      } else if (
        editingService &&
        (editingService.pricingTiers || []).length > 0
      ) {
        await api.updateCatalogPricingTiers(saved.id, []);
      }

      setSuccess(
        editingService
          ? "Serviço atualizado com sucesso."
          : "Serviço cadastrado com sucesso."
      );

      setShowServiceForm(false);
      resetServiceForm();

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao salvar serviço."
      );
    } finally {
      setSaving(false);
    }
  }

  function toggleCategory(id: number) {
    setExpandedCategories((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function servicePriceLabel(service: CatalogService) {
    if (service.pricingMode === "SOB_CONSULTA") {
      return "Sob consulta";
    }

    if (service.pricingMode === "POR_FAIXA") {
      return `${service.pricingTiers?.length || 0} faixa(s) cadastrada(s)`;
    }

    const unit = service.unitLabel
      ? ` / ${service.unitLabel}`
      : "";

    return `${moneyFromCents(service.baseAmount)}${unit}`;
  }

  if (loading) {
    return (
      <section className="page catalog-page">
        <div className="panel">Carregando catálogo técnico-comercial...</div>
      </section>
    );
  }

  return (
    <section className="page catalog-page">
      <div className="page-heading catalog-heading">
        <div>
          <span className="eyebrow">Comercial</span>
          <h1>Catálogo técnico-comercial</h1>
          <p>
            Banco de serviços, estudos técnicos, preços e textos utilizados
            na elaboração das propostas comerciais.
          </p>
        </div>

        <div className="catalog-heading-actions">
          <button
            type="button"
            className="secondary-action"
            onClick={openNewCategory}
          >
            <Tags size={17} />
            Nova categoria
          </button>

          <button
            type="button"
            className="button primary"
            onClick={openNewService}
          >
            <Plus size={17} />
            Novo serviço
          </button>
        </div>
      </div>

      {error && (
        <div className="panel error-panel catalog-message">{error}</div>
      )}

      {success && (
        <div className="panel success-panel catalog-message">
          {success}
        </div>
      )}

      <div className="catalog-metrics">
        <article>
          <div>
            <Tags size={21} />
          </div>
          <span>Categorias</span>
          <strong>{summary?.activeCategories || 0}</strong>
          <small>{summary?.categories || 0} cadastradas</small>
        </article>

        <article>
          <div>
            <BookOpen size={21} />
          </div>
          <span>Serviços ativos</span>
          <strong>{summary?.activeServices || 0}</strong>
          <small>{summary?.services || 0} cadastrados</small>
        </article>

        <article>
          <div>
            <Layers3 size={21} />
          </div>
          <span>Inativos</span>
          <strong>
            {(summary?.services || 0) -
              (summary?.activeServices || 0)}
          </strong>
          <small>preservados no histórico</small>
        </article>

        <article>
          <div>
            <Package size={21} />
          </div>
          <span>Pacotes</span>
          <strong>{summary?.activePackages || 0}</strong>
          <small>{summary?.packages || 0} cadastrados</small>
        </article>
      </div>

      <article className="panel catalog-toolbar">
        <div className="catalog-search">
          <Search size={18} />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, código, sigla ou descrição..."
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="">Todas as categorias</option>

          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {!category.active ? " — inativa" : ""}
            </option>
          ))}
        </select>
      </article>

      <div className="catalog-category-list">
        {categories
          .filter(
            (category) =>
              !categoryFilter ||
              String(category.id) === categoryFilter
          )
          .map((category) => {
            const categoryServices = filteredServices.filter(
              (service) => service.categoryId === category.id
            );

            const open = expandedCategories.has(category.id);

            return (
              <article
                className={`catalog-category-card ${
                  !category.active ? "is-inactive" : ""
                }`}
                key={category.id}
              >
                <button
                  type="button"
                  className="catalog-category-header"
                  onClick={() => toggleCategory(category.id)}
                >
                  <div className="catalog-category-icon">
                    <Tags size={20} />
                  </div>

                  <div className="catalog-category-title">
                    <strong>{category.name}</strong>

                    <span>
                      {category.description ||
                        "Categoria de serviços técnicos"}
                    </span>
                  </div>

                  <div className="catalog-category-meta">
                    <span>
                      {categoryServices.length} serviço(s)
                    </span>

                    {!category.active && (
                      <b className="catalog-inactive-badge">
                        Inativa
                      </b>
                    )}

                    <button
                      type="button"
                      className="catalog-icon-button"
                      title="Editar categoria"
                      onClick={(event) => {
                        event.stopPropagation();
                        editCategory(category);
                      }}
                    >
                      <Edit3 size={16} />
                    </button>

                    {open ? (
                      <ChevronUp size={18} />
                    ) : (
                      <ChevronDown size={18} />
                    )}
                  </div>
                </button>

                {open && (
                  <div className="catalog-services-list">
                    {categoryServices.map((service) => (
                      <div
                        key={service.id}
                        className={`catalog-service-row ${
                          !service.active ? "is-inactive" : ""
                        }`}
                      >
                        <div className="catalog-service-main">
                          <div className="catalog-service-code">
                            {service.acronym ||
                              service.code}
                          </div>

                          <div>
                            <strong>{service.name}</strong>

                            <p>
                              {service.shortDescription ||
                                service.proposalDescription ||
                                "Descrição comercial ainda não cadastrada."}
                            </p>
                          </div>
                        </div>

                        <div className="catalog-service-pricing">
                          <strong>{servicePriceLabel(service)}</strong>

                          <span>
                            {pricingLabels[service.pricingMode]}
                          </span>
                        </div>

                        <div className="catalog-service-deadline">
                          <span>Prazo</span>
                          <strong>
                            {service.defaultExecutionDays
                              ? `${service.defaultExecutionDays} dia(s)`
                              : "—"}
                          </strong>
                        </div>

                        <div className="catalog-service-status">
                          <span
                            className={
                              service.active
                                ? "catalog-active-badge"
                                : "catalog-inactive-badge"
                            }
                          >
                            {service.active ? "Ativo" : "Inativo"}
                          </span>

                          <button
                            type="button"
                            className="secondary-action compact"
                            onClick={() => editService(service)}
                          >
                            Editar
                          </button>
                        </div>
                      </div>
                    ))}

                    {categoryServices.length === 0 && (
                      <div className="catalog-empty">
                        Nenhum serviço encontrado nesta categoria.
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
      </div>

      {categories.length === 0 && (
        <article className="panel catalog-empty-state">
          <Tags size={38} />
          <h2>Comece pelas categorias</h2>
          <p>
            Cadastre Licenciamento Ambiental, Georreferenciamento,
            Aerolevantamento com Drone, CAR e as demais áreas de atuação.
          </p>

          <button
            type="button"
            className="button primary"
            onClick={openNewCategory}
          >
            Criar primeira categoria
          </button>
        </article>
      )}

      {showCategoryForm && (
        <div
          className="modal-backdrop"
          onClick={() => setShowCategoryForm(false)}
        >
          <article
            className="catalog-modal catalog-category-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="eyebrow">Catálogo</span>
                <h2>
                  {editingCategory
                    ? "Editar categoria"
                    : "Nova categoria"}
                </h2>
              </div>

              <button
                type="button"
                className="catalog-close-button"
                onClick={() => setShowCategoryForm(false)}
              >
                <X size={20} />
              </button>
            </header>

            <div className="catalog-form-grid">
              <label>
                Nome *
                <input
                  value={categoryName}
                  onChange={(event) =>
                    setCategoryName(event.target.value)
                  }
                  placeholder="Ex.: Licenciamento Ambiental"
                />
              </label>

              <label>
                Código
                <input
                  value={categoryCode}
                  onChange={(event) =>
                    setCategoryCode(event.target.value)
                  }
                  placeholder="Ex.: LIC-AMBIENTAL"
                />
              </label>

              <label className="full">
                Descrição
                <textarea
                  rows={4}
                  value={categoryDescription}
                  onChange={(event) =>
                    setCategoryDescription(event.target.value)
                  }
                  placeholder="Descrição da categoria..."
                />
              </label>

              <label className="catalog-switch-line full">
                <input
                  type="checkbox"
                  checked={categoryActive}
                  onChange={(event) =>
                    setCategoryActive(event.target.checked)
                  }
                />
                Categoria ativa
              </label>
            </div>

            <footer>
              <button
                className="secondary-action"
                type="button"
                onClick={() => setShowCategoryForm(false)}
              >
                Cancelar
              </button>

              <button
                className="button primary"
                type="button"
                disabled={saving}
                onClick={saveCategory}
              >
                {saving ? "Salvando..." : "Salvar categoria"}
              </button>
            </footer>
          </article>
        </div>
      )}

      {showServiceForm && (
        <div
          className="modal-backdrop"
          onClick={() => setShowServiceForm(false)}
        >
          <article
            className="catalog-modal catalog-service-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="eyebrow">Catálogo técnico-comercial</span>
                <h2>
                  {editingService
                    ? "Editar serviço"
                    : "Novo serviço"}
                </h2>
              </div>

              <button
                type="button"
                className="catalog-close-button"
                onClick={() => setShowServiceForm(false)}
              >
                <X size={20} />
              </button>
            </header>

            <div className="catalog-form-section">
              <div className="catalog-section-title">
                <span>01</span>
                <div>
                  <strong>Identificação</strong>
                  <small>Classificação e identificação do serviço.</small>
                </div>
              </div>

              <div className="catalog-form-grid">
                <label>
                  Categoria *
                  <select
                    value={serviceForm.categoryId}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        categoryId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Selecione...</option>

                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Código
                  <input
                    value={serviceForm.code}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        code: event.target.value,
                      }))
                    }
                    placeholder="Ex.: AMB-RCA"
                  />
                </label>

                <label className="full">
                  Nome do serviço *
                  <input
                    value={serviceForm.name}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Ex.: Relatório de Controle Ambiental"
                  />
                </label>

                <label>
                  Sigla
                  <input
                    value={serviceForm.acronym}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        acronym: event.target.value,
                      }))
                    }
                    placeholder="RCA"
                  />
                </label>

                <label>
                  Ordem
                  <input
                    type="number"
                    value={serviceForm.sortOrder}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        sortOrder: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="full">
                  Descrição resumida
                  <textarea
                    rows={3}
                    value={serviceForm.shortDescription}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        shortDescription: event.target.value,
                      }))
                    }
                    placeholder="Resumo para telas internas e pesquisa."
                  />
                </label>
              </div>
            </div>

            <div className="catalog-form-section">
              <div className="catalog-section-title">
                <span>02</span>
                <div>
                  <strong>Conteúdo da proposta</strong>
                  <small>
                    Textos que poderão ser inseridos automaticamente.
                  </small>
                </div>
              </div>

              <div className="catalog-form-grid">
                <label className="full">
                  Descrição comercial para a proposta
                  <textarea
                    rows={6}
                    value={serviceForm.proposalDescription}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        proposalDescription: event.target.value,
                      }))
                    }
                    placeholder="Descrição completa do serviço que aparecerá na proposta comercial..."
                  />
                </label>

                <label className="full">
                  Descrição técnica
                  <textarea
                    rows={5}
                    value={serviceForm.technicalDescription}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        technicalDescription: event.target.value,
                      }))
                    }
                    placeholder="Escopo técnico, metodologia, produtos esperados..."
                  />
                </label>

                <label className="full">
                  Fundamentação / texto legal
                  <textarea
                    rows={5}
                    value={serviceForm.legalText}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        legalText: event.target.value,
                      }))
                    }
                    placeholder="Base legal e justificativa técnica padrão..."
                  />
                </label>
              </div>
            </div>

            <div className="catalog-form-section">
              <div className="catalog-section-title">
                <span>03</span>
                <div>
                  <strong>Precificação</strong>
                  <small>
                    Regra utilizada para calcular o orçamento.
                  </small>
                </div>
              </div>

              <div className="catalog-form-grid">
                <label>
                  Modalidade *
                  <select
                    value={serviceForm.pricingMode}
                    onChange={(event) =>
                      setPricingMode(
                        event.target.value as PricingMode
                      )
                    }
                  >
                    {Object.entries(pricingLabels).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  Unidade
                  <input
                    value={serviceForm.unitLabel}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        unitLabel: event.target.value,
                      }))
                    }
                    placeholder="Serviço, ha, km..."
                  />
                </label>

                {serviceForm.pricingMode !== "SOB_CONSULTA" &&
                  serviceForm.pricingMode !== "POR_FAIXA" && (
                    <>
                      <label>
                        Valor padrão (R$) *
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={serviceForm.baseAmount}
                          onChange={(event) =>
                            setServiceForm((current) => ({
                              ...current,
                              baseAmount: event.target.value,
                            }))
                          }
                          placeholder="7000.00"
                        />
                      </label>

                      <label>
                        Valor mínimo (R$)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={serviceForm.minimumAmount}
                          onChange={(event) =>
                            setServiceForm((current) => ({
                              ...current,
                              minimumAmount: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </>
                  )}
              </div>

              {serviceForm.pricingMode === "POR_FAIXA" && (
                <div className="catalog-tier-editor">
                  <div className="catalog-tier-header">
                    <div>
                      <strong>Faixas de preço</strong>
                      <p>
                        Defina os intervalos e valores unitários.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="secondary-action"
                      onClick={addPricingTier}
                    >
                      <Plus size={15} />
                      Adicionar faixa
                    </button>
                  </div>

                  {pricingTiers.map((tier, index) => (
                    <div
                      className="catalog-tier-row"
                      key={index}
                    >
                      <label>
                        De
                        <input
                          type="number"
                          min="0"
                          value={tier.minQuantity}
                          onChange={(event) =>
                            setPricingTiers((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      minQuantity:
                                        event.target.value,
                                    }
                                  : item
                              )
                            )
                          }
                        />
                      </label>

                      <label>
                        Até
                        <input
                          type="number"
                          min="0"
                          value={tier.maxQuantity}
                          onChange={(event) =>
                            setPricingTiers((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      maxQuantity:
                                        event.target.value,
                                    }
                                  : item
                              )
                            )
                          }
                        />
                      </label>

                      <label>
                        Valor unitário (R$)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={tier.unitAmount}
                          onChange={(event) =>
                            setPricingTiers((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      unitAmount:
                                        event.target.value,
                                    }
                                  : item
                              )
                            )
                          }
                        />
                      </label>

                      <label>
                        Mínimo (R$)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={tier.minimumAmount}
                          onChange={(event) =>
                            setPricingTiers((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      minimumAmount:
                                        event.target.value,
                                    }
                                  : item
                              )
                            )
                          }
                        />
                      </label>

                      <button
                        type="button"
                        className="catalog-remove-tier"
                        onClick={() => removePricingTier(index)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="catalog-form-section">
              <div className="catalog-section-title">
                <span>04</span>
                <div>
                  <strong>Execução e controle</strong>
                  <small>
                    Prazo padrão e regras comerciais.
                  </small>
                </div>
              </div>

              <div className="catalog-form-grid">
                <label>
                  Prazo padrão em dias
                  <input
                    type="number"
                    min="0"
                    value={serviceForm.defaultExecutionDays}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        defaultExecutionDays:
                          event.target.value,
                      }))
                    }
                  />
                </label>

                <div className="catalog-checkbox-stack">
                  <label className="catalog-switch-line">
                    <input
                      type="checkbox"
                      checked={serviceForm.allowManualPrice}
                      onChange={(event) =>
                        setServiceForm((current) => ({
                          ...current,
                          allowManualPrice:
                            event.target.checked,
                        }))
                      }
                    />
                    Permitir alteração manual do preço
                  </label>

                  <label className="catalog-switch-line">
                    <input
                      type="checkbox"
                      checked={serviceForm.active}
                      onChange={(event) =>
                        setServiceForm((current) => ({
                          ...current,
                          active: event.target.checked,
                        }))
                      }
                    />
                    Serviço ativo
                  </label>
                </div>
              </div>
            </div>

            <footer>
              <button
                type="button"
                className="secondary-action"
                onClick={() => setShowServiceForm(false)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="button primary"
                disabled={saving}
                onClick={saveService}
              >
                {saving ? "Salvando..." : "Salvar serviço"}
              </button>
            </footer>
          </article>
        </div>
      )}
    </section>
  );
}
