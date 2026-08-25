import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CircleDollarSign,
  FileText,
  Layers3,
  Paperclip,
  Pencil,
} from "lucide-react";

import { api } from "../services/api";
import "./StandaloneProposalEditorPage.css";

type ProposalAttachment = {
  id: number;
  proposalId: number;

  type: "LISTADO" | "ARQUIVO";

  title: string;
  description?: string | null;

  fileName?: string | null;
  filePath?: string | null;
  mimeType?: string | null;
  size?: number | null;

  sortOrder: number;

  generatedPdfPath?: string | null;
  generatedPdfName?: string | null;
  generatedPdfHash?: string | null;
  generatedAt?: string | null;

  createdAt: string;
  updatedAt: string;
};

type ProposalEvent = {
  id: number;
  eventType: string;
  title: string;
  description?: string | null;

  actorUserId?: number | null;
  actorName?: string | null;
  actorEmail?: string | null;

  recipient?: string | null;

  createdAt: string;
};

type Proposal = {
  id: number;
  proposalNumber: string;

  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientWhatsapp?: string | null;
  clientCity?: string | null;
  clientState?: string | null;

  title: string;
  objectText?: string | null;

  status: string;

  subtotalAmount: number;
  discountAmount: number;
  additionAmount: number;
  totalAmount: number;

  paymentMode:
    | "A_VISTA"
    | "ENTRADA_PARCELAS"
    | "PARCELADO"
    | "PERSONALIZADO";

  entryAmount: number;
  installmentQty?: number | null;
  installmentAmount?: number | null;
  paymentText?: string | null;

  executionDays?: number | null;
  executionText?: string | null;

  validUntil?: string | null;

  notes?: string | null;
  internalNotes?: string | null;

  validityDays?: number | null;


  generatedPdfPath?: string | null;
  generatedPdfName?: string | null;
  generatedPdfHash?: string | null;
  generatedAt?: string | null;

  createdAt: string;
  updatedAt: string;

  items?: ProposalItem[];
  attachments?: ProposalAttachment[];
  events?: ProposalEvent[];

  verbalApprovedAt?: string | null;
  verbalApprovedBy?: string | null;
  verbalApprovalNote?: string | null;
};

type CatalogPricingMode =
  | "FIXO"
  | "POR_HECTARE"
  | "POR_KM"
  | "POR_UNIDADE"
  | "POR_MODULO_FISCAL"
  | "POR_DIARIA"
  | "POR_HORA"
  | "POR_FAIXA"
  | "SOB_CONSULTA";

type CatalogPricingTier = {
  id: number;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  unitAmount: number;
  minimumAmount?: number | null;
  active: boolean;
  sortOrder: number;
};

type CatalogCategory = {
  id: number;
  name: string;
  code?: string | null;
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

  pricingMode: CatalogPricingMode;

  baseAmount?: number | null;
  minimumAmount?: number | null;
  unitLabel?: string | null;

  allowManualPrice?: boolean;
  active: boolean;

  category: CatalogCategory;
  pricingTiers: CatalogPricingTier[];
};

type ProposalItem = {
  id: number;

  catalogServiceId?: number | null;
  catalogServiceCode?: string | null;
  categoryName?: string | null;

  serviceName: string;
  acronym?: string | null;

  // Resumo curto usado na tabela comercial.
  summaryDescription?: string | null;

  // Texto comercial completo.
  commercialDescription?: string | null;

  // Campo legado.
  description?: string | null;

  // Texto técnico detalhado.
  technicalDescription?: string | null;

  // Fundamentação legal/normativa.
  legalText?: string | null;

  pricingMode?: CatalogPricingMode | null;

  quantity: number;
  unitLabel?: string | null;

  catalogUnitAmount?: number | null;
  unitAmount: number;
  totalAmount: number;

  manualPrice: boolean;

  sortOrder: number;
};


function money(value?: number | null) {
  return (Number(value || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function apiPublicFileUrl(
  filePath?: string | null
) {
  if (!filePath) return "#";

  if (
    filePath.startsWith("http://") ||
    filePath.startsWith("https://")
  ) {
    return filePath;
  }

  const configuredApi =
    String(
      import.meta.env.VITE_API_URL ||
      "https://api.amazonikaengenharia.com.br"
    ).replace(/\/$/, "");

  const normalizedPath =
    filePath.startsWith("/")
      ? filePath
      : `/${filePath}`;

  return `${configuredApi}${normalizedPath}`;
}

function fileSize(value?: number | null) {
  const bytes = Number(value || 0);

  if (!bytes) return "";

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    1024 /
    1024
  ).toFixed(2)} MB`;
}

function date(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(value)
  );
}

function dateTime(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(
    new Date(value)
  );
}

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    RASCUNHO: "Rascunho",
    GERADA: "PDF gerado",
    ENVIADA: "Enviada",
    APROVADA_VERBALMENTE: "Aprovada verbalmente",
    AGUARDANDO_ASSINATURA: "Aguardando assinatura",
    ASSINADA_ELETRONICAMENTE: "Assinada eletronicamente",
    PDF_ASSINADO_ANEXADO: "PDF assinado anexado",
    RECUSADA: "Recusada",
    EXPIRADA: "Expirada",
    VINCULADA_PROTOCOLO: "Vinculada ao protocolo",
    CANCELADA: "Cancelada",
  };

  return labels[status || ""] || status || "-";
}

export default function StandaloneProposalEditorPage() {
  const params = useParams();
  const navigate = useNavigate();

  const proposalId = Number(params.id);

  const [proposal, setProposal] =
    useState<Proposal | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [catalogOpen, setCatalogOpen] =
    useState(false);

  const [catalogLoading, setCatalogLoading] =
    useState(false);

  const [catalogServices, setCatalogServices] =
    useState<CatalogService[]>([]);

  const [catalogSearch, setCatalogSearch] =
    useState("");

  const [attachmentOpen, setAttachmentOpen] =
    useState(false);

  const [attachmentSaving, setAttachmentSaving] =
    useState(false);

  const [attachmentTitle, setAttachmentTitle] =
    useState("");

  const [attachmentDescription, setAttachmentDescription] =
    useState("");

  const [deletingAttachmentId, setDeletingAttachmentId] =
    useState<number | null>(null);

  const [attachmentMode, setAttachmentMode] =
    useState<"LISTADO" | "ARQUIVO">("LISTADO");

  const [attachmentFile, setAttachmentFile] =
    useState<File | null>(null);


  const [catalogCategoryId, setCatalogCategoryId] =
    useState<number | "all">("all");

  const [selectedCatalogService, setSelectedCatalogService] =
    useState<CatalogService | null>(null);

  const [catalogQuantity, setCatalogQuantity] =
    useState("1");

  const [catalogUnitAmount, setCatalogUnitAmount] =
    useState("");

  const [catalogDescription, setCatalogDescription] =
    useState("");

  const [addingCatalogItem, setAddingCatalogItem] =
    useState(false);

  const [deletingItemId, setDeletingItemId] =
    useState<number | null>(null);

  // ======================================================
  // EDIÇÃO INDIVIDUAL DOS SERVIÇOS
  // ======================================================

  const [editingItem, setEditingItem] =
    useState<ProposalItem | null>(null);

  const [itemEditSaving, setItemEditSaving] =
    useState(false);

  const [itemEditForm, setItemEditForm] =
    useState({
      serviceName: "",
      summaryDescription: "",
      commercialDescription: "",
      technicalDescription: "",
      legalText: "",
      quantity: "1",
      unitLabel: "",
      unitAmount: "",
    });

  const [showEditModal, setShowEditModal] =
    useState(false);

  const [editing, setEditing] =
    useState(false);

  const [flowActionOpen, setFlowActionOpen] =
    useState<
      "APPROVE" |
      "CANCEL" |
      null
    >(null);

  const [flowSaving, setFlowSaving] =
    useState(false);

  const [approvalName, setApprovalName] =
    useState("");

  const [approvalNote, setApprovalNote] =
    useState("");

  const [cancelReason, setCancelReason] =
    useState("");

  const [duplicating, setDuplicating] =
    useState(false);

  const [sendEmailOpen, setSendEmailOpen] =
    useState(false);

  const [sendEmailAddress, setSendEmailAddress] =
    useState("");

  const [sendingEmail, setSendingEmail] =
    useState(false);

  const [sendEmailMessage, setSendEmailMessage] =
    useState("");

  const [editForm, setEditForm] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientWhatsapp: "",
    clientCity: "",
    clientState: "",
    title: "",
    objectText: "",
  });

  const [commercialPaymentMode, setCommercialPaymentMode] =
    useState<
      | "A_VISTA"
      | "ENTRADA_PARCELAS"
      | "PARCELADO"
      | "PERSONALIZADO"
    >("ENTRADA_PARCELAS");

  const [commercialEntryAmount, setCommercialEntryAmount] =
    useState("");

  const [commercialInstallmentQty, setCommercialInstallmentQty] =
    useState("1");

  const [commercialDiscount, setCommercialDiscount] =
    useState("");

  const [commercialAddition, setCommercialAddition] =
    useState("");

  const [commercialExecutionDays, setCommercialExecutionDays] =
    useState("");

  const [commercialValidityDays, setCommercialValidityDays] =
    useState("15");

  const [commercialPaymentText, setCommercialPaymentText] =
    useState("");

  const [commercialExecutionText, setCommercialExecutionText] =
    useState("");

  const [commercialNotes, setCommercialNotes] =
    useState("");

  const [commercialSaving, setCommercialSaving] =
    useState(false);

  const [generatingPdf, setGeneratingPdf] =
    useState(false);

  const [pdfMessage, setPdfMessage] =
    useState("");

  const [openingPdf, setOpeningPdf] =
    useState(false);

  const [downloadingPdf, setDownloadingPdf] =
    useState(false);

  function syncCommercialForm(
    current: Proposal
  ) {
    setCommercialPaymentMode(
      current.paymentMode ||
        "ENTRADA_PARCELAS"
    );

    setCommercialEntryAmount(
      centsToInput(
        current.entryAmount || 0
      )
    );

    setCommercialInstallmentQty(
      current.installmentQty
        ? String(
            current.installmentQty
          )
        : "1"
    );

    setCommercialDiscount(
      centsToInput(
        current.discountAmount || 0
      )
    );

    setCommercialAddition(
      centsToInput(
        current.additionAmount || 0
      )
    );

    setCommercialExecutionDays(
      current.executionDays
        ? String(
            current.executionDays
          )
        : ""
    );

    if (current.validUntil) {
      const now =
        new Date();

      const valid =
        new Date(
          current.validUntil
        );

      const difference =
        Math.max(
          1,
          Math.ceil(
            (
              valid.getTime() -
              now.getTime()
            ) /
              86400000
          )
        );

      setCommercialValidityDays(
        String(difference)
      );
    } else {
      setCommercialValidityDays("15");
    }

    setCommercialPaymentText(
      current.paymentText || ""
    );

    setCommercialExecutionText(
      current.executionText || ""
    );

    setCommercialNotes(
      current.notes || ""
    );
  }

  function pricingModeLabel(
    mode?: CatalogPricingMode | null
  ) {
    const labels: Record<CatalogPricingMode, string> = {
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

    return mode ? labels[mode] : "-";
  }

  function numberFromInput(value: string) {
    const normalized = value
      .trim()
      .replace(/\./g, "")
      .replace(",", ".");

    const parsed = Number(normalized);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function currencyInputToCents(value: string) {
    if (!value.trim()) {
      return 0;
    }

    return Math.round(
      numberFromInput(value) * 100
    );
  }

  function centsToInput(value?: number | null) {
    if (value === null || value === undefined) {
      return "";
    }

    return (value / 100).toFixed(2).replace(".", ",");
  }

  function resolvedCatalogUnitAmount(
    service: CatalogService,
    quantity: number
  ) {
    if (service.pricingMode === "POR_FAIXA") {
      const tier = service.pricingTiers
        .filter((item) => item.active)
        .find((item) => {
          const min =
            item.minQuantity ??
            Number.NEGATIVE_INFINITY;

          const max =
            item.maxQuantity ??
            Number.POSITIVE_INFINITY;

          return quantity >= min && quantity <= max;
        });

      return tier?.unitAmount ?? null;
    }

    return service.baseAmount ?? null;
  }

  function catalogPreviewTotal() {
    if (!selectedCatalogService) {
      return 0;
    }

    const quantity =
      Math.max(
        0,
        numberFromInput(catalogQuantity)
      );

    let unitAmount =
      selectedCatalogService.pricingMode ===
      "SOB_CONSULTA"
        ? currencyInputToCents(catalogUnitAmount)
        : resolvedCatalogUnitAmount(
            selectedCatalogService,
            quantity
          ) ?? 0;

    if (
      selectedCatalogService.allowManualPrice &&
      catalogUnitAmount.trim()
    ) {
      unitAmount =
        currencyInputToCents(catalogUnitAmount);
    }

    let total =
      Math.round(quantity * unitAmount);

    if (
      selectedCatalogService.minimumAmount &&
      total <
        selectedCatalogService.minimumAmount
    ) {
      total =
        selectedCatalogService.minimumAmount;
    }

    return total;
  }

  async function loadCatalog() {
    try {
      setCatalogLoading(true);
      setError("");

      const data =
        (await api.catalogServices({
          includeInactive: false,
        })) as CatalogService[];

      setCatalogServices(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar catálogo."
      );
    } finally {
      setCatalogLoading(false);
    }
  }

  function openCatalog() {
    setCatalogOpen(true);
    setSelectedCatalogService(null);
    setCatalogSearch("");
    setCatalogCategoryId("all");

    if (catalogServices.length === 0) {
      loadCatalog();
    }
  }

  function selectCatalogService(
    service: CatalogService
  ) {
    setSelectedCatalogService(service);

    setCatalogQuantity("1");

    setCatalogDescription(
      service.proposalDescription ||
      service.shortDescription ||
      ""
    );

    if (
      service.pricingMode === "SOB_CONSULTA"
    ) {
      setCatalogUnitAmount("");
    } else {
      setCatalogUnitAmount(
        centsToInput(service.baseAmount)
      );
    }
  }

  async function addCatalogItem() {
    if (
      !proposal ||
      !selectedCatalogService
    ) {
      return;
    }

    const quantity =
      numberFromInput(catalogQuantity);

    if (quantity <= 0) {
      setError(
        "Informe uma quantidade maior que zero."
      );
      return;
    }

    const body: {
      catalogServiceId: number;
      quantity: number;
      unitAmount?: number;
      description?: string | null;
    } = {
      catalogServiceId:
        selectedCatalogService.id,

      quantity,

      description:
        catalogDescription.trim() || null,
    };

    if (
      selectedCatalogService.pricingMode ===
      "SOB_CONSULTA"
    ) {
      const amount =
        currencyInputToCents(
          catalogUnitAmount
        );

      if (amount <= 0) {
        setError(
          "Informe o valor negociado para este serviço."
        );
        return;
      }

      body.unitAmount = amount;
    } else if (
      selectedCatalogService.allowManualPrice &&
      catalogUnitAmount.trim() &&
      currencyInputToCents(
        catalogUnitAmount
      ) !==
        (selectedCatalogService.baseAmount ?? 0)
    ) {
      body.unitAmount =
        currencyInputToCents(
          catalogUnitAmount
        );
    }

    try {
      setAddingCatalogItem(true);
      setError("");

      await api.addStandaloneProposalCatalogItem(
        proposal.id,
        body
      );

      await loadProposal();

      setSelectedCatalogService(null);
      setCatalogOpen(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao adicionar serviço."
      );
    } finally {
      setAddingCatalogItem(false);
    }
  }

  async function removeProposalItem(
    item: ProposalItem
  ) {
    if (!proposal) return;

    const confirmed =
      window.confirm(
        `Remover "${item.serviceName}" desta proposta?`
      );

    if (!confirmed) return;

    try {
      setDeletingItemId(item.id);
      setError("");

      await api.deleteStandaloneProposalItem(
        proposal.id,
        item.id
      );

      await loadProposal();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao remover item."
      );
    } finally {
      setDeletingItemId(null);
    }
  }

  function openProposalItemEditor(
    item: ProposalItem
  ) {
    setError("");

    setEditingItem(item);

    setItemEditForm({
      serviceName:
        item.serviceName || "",

      summaryDescription:
        item.summaryDescription || "",

      commercialDescription:
        item.commercialDescription ||
        item.description ||
        "",

      technicalDescription:
        item.technicalDescription || "",

      legalText:
        item.legalText || "",

      quantity:
        String(item.quantity || 1),

      unitLabel:
        item.unitLabel || "",

      unitAmount:
        centsToInput(
          item.unitAmount
        ),
    });
  }

  function closeProposalItemEditor() {
    if (itemEditSaving) {
      return;
    }

    setEditingItem(null);
  }

  async function saveProposalItemEditor() {
    if (
      !proposal ||
      !editingItem
    ) {
      return;
    }

    const serviceName =
      itemEditForm.serviceName.trim();

    const quantity =
      numberFromInput(
        itemEditForm.quantity
      );

    const unitAmount =
      currencyInputToCents(
        itemEditForm.unitAmount
      );

    if (!serviceName) {
      setError(
        "Informe o nome do serviço."
      );
      return;
    }

    if (quantity <= 0) {
      setError(
        "A quantidade deve ser maior que zero."
      );
      return;
    }

    if (unitAmount < 0) {
      setError(
        "Informe um valor unitário válido."
      );
      return;
    }

    const commercialDescription =
      itemEditForm
        .commercialDescription
        .trim() || null;

    try {
      setItemEditSaving(true);
      setError("");

      await api.updateStandaloneProposalItem(
        proposal.id,
        editingItem.id,
        {
          serviceName,

          summaryDescription:
            itemEditForm
              .summaryDescription
              .trim() || null,

          commercialDescription,

          // Mantém propostas e rotinas antigas compatíveis.
          description:
            commercialDescription,

          technicalDescription:
            itemEditForm
              .technicalDescription
              .trim() || null,

          legalText:
            itemEditForm
              .legalText
              .trim() || null,

          quantity,

          unitLabel:
            itemEditForm
              .unitLabel
              .trim() || null,

          unitAmount,
        }
      );

      await loadProposal();

      setEditingItem(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao atualizar serviço."
      );
    } finally {
      setItemEditSaving(false);
    }
  }

  async function loadProposal() {
    if (!Number.isFinite(proposalId) || proposalId <= 0) {
      setError("Proposta inválida.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const data =
        (await api.standaloneProposal(
          proposalId
        )) as Proposal;

      setProposal(data);

      syncCommercialForm(data);

      setEditForm({
        clientName: data.clientName || "",
        clientEmail: data.clientEmail || "",
        clientPhone: data.clientPhone || "",
        clientWhatsapp: data.clientWhatsapp || "",
        clientCity: data.clientCity || "",
        clientState: data.clientState || "",
        title: data.title || "",
        objectText: data.objectText || "",
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar proposta."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProposal();
  }, [proposalId]);

  async function saveProposalData() {
    if (!proposal) return;

    if (!editForm.clientName.trim()) {
      setError("Informe o nome ou razão social do cliente.");
      return;
    }

    if (!editForm.title.trim()) {
      setError("Informe o objeto resumido da proposta.");
      return;
    }

    try {
      setEditing(true);
      setError("");

      await api.updateStandaloneProposal(
        proposal.id,
        {
          clientName:
            editForm.clientName.trim(),

          clientEmail:
            editForm.clientEmail.trim() || null,

          clientPhone:
            editForm.clientPhone.trim() || null,

          clientWhatsapp:
            editForm.clientWhatsapp.trim() || null,

          clientCity:
            editForm.clientCity.trim() || null,

          clientState:
            editForm.clientState.trim() || null,

          title:
            editForm.title.trim(),

          objectText:
            editForm.objectText.trim() || null,
        }
      );

      await loadProposal();

      setShowEditModal(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao atualizar proposta."
      );
    } finally {
      setEditing(false);
    }
  }

  async function saveAttachment() {
    try {
      setError("");

      const title =
        attachmentTitle.trim();

      if (!title) {
        throw new Error(
          "Informe o título do anexo."
        );
      }

      if (
        attachmentMode === "ARQUIVO" &&
        !attachmentFile
      ) {
        throw new Error(
          "Selecione o arquivo que será anexado."
        );
      }

      if (
        attachmentFile &&
        attachmentFile.size >
          25 * 1024 * 1024
      ) {
        throw new Error(
          "O arquivo deve possuir no máximo 25 MB."
        );
      }

      setAttachmentSaving(true);

      if (
        attachmentMode === "ARQUIVO" &&
        attachmentFile
      ) {
        await api.uploadStandaloneProposalAttachment(
          proposalId,
          {
            title,
            description:
              attachmentDescription.trim() ||
              null,
            file:
              attachmentFile,
          }
        );
      } else {
        await api.addStandaloneProposalAttachment(
          proposalId,
          {
            title,
            description:
              attachmentDescription.trim() ||
              null,
          }
        );
      }

      setAttachmentTitle("");
      setAttachmentDescription("");
      setAttachmentMode("LISTADO");
      setAttachmentFile(null);
      setAttachmentOpen(false);

      await loadProposal();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Erro ao adicionar anexo."
      );
    } finally {
      setAttachmentSaving(false);
    }
  }

  async function deleteAttachment(
    attachmentId: number
  ) {
    try {
      setError("");

      setDeletingAttachmentId(
        attachmentId
      );

      await api.deleteStandaloneProposalAttachment(
        proposalId,
        attachmentId
      );

      await loadProposal();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Erro ao remover anexo."
      );
    } finally {
      setDeletingAttachmentId(null);
    }
  }

  function commercialTotalPreview() {
    if (!proposal) return 0;

    const discount =
      currencyInputToCents(
        commercialDiscount
      );

    const addition =
      currencyInputToCents(
        commercialAddition
      );

    return Math.max(
      0,
      proposal.subtotalAmount -
        discount +
        addition
    );
  }

  function commercialEntryPreview() {
    const total =
      commercialTotalPreview();

    if (
      commercialPaymentMode ===
      "A_VISTA"
    ) {
      return total;
    }

    if (
      commercialPaymentMode ===
      "PARCELADO"
    ) {
      return 0;
    }

    return Math.min(
      total,
      currencyInputToCents(
        commercialEntryAmount
      )
    );
  }

  function commercialInstallmentPreview() {
    const total =
      commercialTotalPreview();

    const qty =
      Math.max(
        1,
        Number(
          commercialInstallmentQty ||
          1
        )
      );

    if (
      commercialPaymentMode ===
      "A_VISTA"
    ) {
      return 0;
    }

    if (
      commercialPaymentMode ===
      "PARCELADO"
    ) {
      return Math.round(
        total / qty
      );
    }

    if (
      commercialPaymentMode ===
      "ENTRADA_PARCELAS"
    ) {
      return Math.round(
        Math.max(
          0,
          total -
            commercialEntryPreview()
        ) / qty
      );
    }

    return proposal?.installmentAmount || 0;
  }

  function generatedPaymentText() {
    const total =
      commercialTotalPreview();

    const entry =
      commercialEntryPreview();

    const qty =
      Math.max(
        1,
        Number(
          commercialInstallmentQty ||
          1
        )
      );

    const installment =
      commercialInstallmentPreview();

    if (
      commercialPaymentMode ===
      "A_VISTA"
    ) {
      return `Pagamento à vista no valor de ${money(
        total
      )}.`;
    }

    if (
      commercialPaymentMode ===
      "PARCELADO"
    ) {
      return `Pagamento em ${qty} parcela(s) de aproximadamente ${money(
        installment
      )}.`;
    }

    if (
      commercialPaymentMode ===
      "ENTRADA_PARCELAS"
    ) {
      return `Entrada de ${money(
        entry
      )} e saldo remanescente em ${qty} parcela(s) de aproximadamente ${money(
        installment
      )}.`;
    }

    return commercialPaymentText.trim();
  }

  async function saveCommercialConditions() {
    if (!proposal) return;

    try {
      setError("");
      setCommercialSaving(true);

      const total =
        commercialTotalPreview();

      const installmentQty =
        commercialPaymentMode ===
          "A_VISTA"
          ? null
          : Math.max(
              1,
              Number(
                commercialInstallmentQty ||
                1
              )
            );

      if (
        commercialPaymentMode ===
          "PERSONALIZADO" &&
        !commercialPaymentText.trim()
      ) {
        throw new Error(
          "Informe a condição de pagamento personalizada."
        );
      }

      const validityDays =
        Math.max(
          1,
          Number(
            commercialValidityDays ||
            15
          )
        );

      const validUntil =
        new Date();

      validUntil.setDate(
        validUntil.getDate() +
          validityDays
      );

      await api.updateStandaloneProposal(
        proposalId,
        {
          paymentMode:
            commercialPaymentMode,

          discountAmount:
            currencyInputToCents(
              commercialDiscount
            ),

          additionAmount:
            currencyInputToCents(
              commercialAddition
            ),

          entryAmount:
            commercialEntryPreview(),

          installmentQty,

          installmentAmount:
            commercialPaymentMode ===
              "A_VISTA"
              ? null
              : commercialInstallmentPreview(),

          paymentText:
            commercialPaymentMode ===
              "PERSONALIZADO"
              ? commercialPaymentText.trim()
              : generatedPaymentText(),

          executionDays:
            commercialExecutionDays
              ? Math.max(
                  1,
                  Number(
                    commercialExecutionDays
                  )
                )
              : null,

          executionText:
            commercialExecutionText.trim() ||
            null,

          validUntil:
            validUntil.toISOString(),

          notes:
            commercialNotes.trim() ||
            null,

          totalAmount:
            total,
        }
      );

      await loadProposal();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Erro ao salvar condições comerciais."
      );
    } finally {
      setCommercialSaving(false);
    }
  }

  async function generateProposalPdf() {
    if (!proposal) return;

    try {
      setError("");
      setPdfMessage("");
      setGeneratingPdf(true);

      /*
       * Primeiro salva as condições comerciais atualmente
       * visíveis no formulário. Assim o PDF nunca será gerado
       * com valores antigos.
       */
      const total =
        commercialTotalPreview();

      const installmentQty =
        commercialPaymentMode === "A_VISTA"
          ? null
          : Math.max(
              1,
              Number(
                commercialInstallmentQty || 1
              )
            );

      if (
        commercialPaymentMode === "PERSONALIZADO" &&
        !commercialPaymentText.trim()
      ) {
        throw new Error(
          "Informe a condição de pagamento personalizada."
        );
      }

      const validityDays =
        Math.max(
          1,
          Number(
            commercialValidityDays || 15
          )
        );

      const validUntil = new Date();

      validUntil.setDate(
        validUntil.getDate() +
          validityDays
      );

      await api.updateStandaloneProposal(
        proposalId,
        {
          paymentMode:
            commercialPaymentMode,

          discountAmount:
            currencyInputToCents(
              commercialDiscount
            ),

          additionAmount:
            currencyInputToCents(
              commercialAddition
            ),

          entryAmount:
            commercialEntryPreview(),

          installmentQty,

          installmentAmount:
            commercialPaymentMode === "A_VISTA"
              ? null
              : commercialInstallmentPreview(),

          paymentText:
            commercialPaymentMode === "PERSONALIZADO"
              ? commercialPaymentText.trim()
              : generatedPaymentText(),

          executionDays:
            commercialExecutionDays
              ? Math.max(
                  1,
                  Number(
                    commercialExecutionDays
                  )
                )
              : null,

          executionText:
            commercialExecutionText.trim() ||
            null,

          validUntil:
            validUntil.toISOString(),

          notes:
            commercialNotes.trim() ||
            null,

          totalAmount:
            total,
        }
      );

      const result =
        (await api.generateStandaloneProposalPdf(
          proposalId
        )) as {
          message?: string;
          fileName?: string;
          sha256?: string;
        };

      setPdfMessage(
        result.message ||
          "PDF gerado com sucesso."
      );

      await loadProposal();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Erro ao gerar PDF."
      );
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function viewProposalPdf() {
    if (!proposal?.generatedPdfName) {
      return;
    }

    try {
      setError("");
      setOpeningPdf(true);

      const result =
        await api.standaloneProposalPdfBlob(
          proposalId
        );

      const url =
        URL.createObjectURL(
          result.blob
        );

      const win =
        window.open(
          url,
          "_blank",
          "noopener,noreferrer"
        );

      if (!win) {
        URL.revokeObjectURL(url);

        throw new Error(
          "O navegador bloqueou a abertura do PDF. Permita pop-ups para visualizar o documento."
        );
      }

      /*
       * Aguarda tempo suficiente para a nova aba
       * consumir o blob antes de liberar a URL.
       */
      window.setTimeout(
        () => {
          URL.revokeObjectURL(
            url
          );
        },
        60000
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Erro ao visualizar PDF."
      );
    } finally {
      setOpeningPdf(false);
    }
  }

  async function downloadProposalPdf() {
    if (!proposal?.generatedPdfName) {
      return;
    }

    try {
      setError("");
      setDownloadingPdf(true);

      const result =
        await api.standaloneProposalPdfBlob(
          proposalId
        );

      const url =
        URL.createObjectURL(
          result.blob
        );

      const anchor =
        document.createElement("a");

      anchor.href = url;

      anchor.download =
        proposal.generatedPdfName ||
        `${proposal.proposalNumber}.pdf`;

      document.body.appendChild(
        anchor
      );

      anchor.click();
      anchor.remove();

      window.setTimeout(
        () => {
          URL.revokeObjectURL(
            url
          );
        },
        1000
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Erro ao baixar PDF."
      );
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function approveVerbally() {
    if (!proposal) return;

    if (!approvalName.trim()) {
      setError(
        "Informe quem aprovou a proposta."
      );
      return;
    }

    try {
      setError("");
      setFlowSaving(true);

      await api.approveStandaloneProposalVerbally(
        proposal.id,
        {
          approvedBy:
            approvalName.trim(),

          note:
            approvalNote.trim() ||
            null,
        }
      );

      setFlowActionOpen(null);
      setApprovalName("");
      setApprovalNote("");

      await loadProposal();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Erro ao registrar aprovação."
      );
    } finally {
      setFlowSaving(false);
    }
  }

  async function cancelProposal() {
    if (!proposal) return;

    try {
      setError("");
      setFlowSaving(true);

      await api.cancelStandaloneProposal(
        proposal.id,
        {
          reason:
            cancelReason.trim() ||
            null,
        }
      );

      setFlowActionOpen(null);
      setCancelReason("");

      await loadProposal();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Erro ao cancelar proposta."
      );
    } finally {
      setFlowSaving(false);
    }
  }

  function openSendEmailModal() {
    if (!proposal) return;

    setSendEmailAddress(
      proposal.clientEmail || ""
    );

    setSendEmailMessage("");
    setSendEmailOpen(true);
  }

  async function sendProposalEmail() {
    if (!proposal) return;

    const email =
      sendEmailAddress.trim();

    if (!email) {
      setError(
        "Informe o e-mail do destinatário."
      );
      return;
    }

    try {
      setError("");
      setSendEmailMessage("");
      setSendingEmail(true);

      await api.sendStandaloneProposalEmail(
        proposal.id,
        {
          email,
        }
      );

      setSendEmailMessage(
        "Proposta enviada por e-mail com sucesso."
      );

      await loadProposal();

      window.setTimeout(() => {
        setSendEmailOpen(false);
        setSendEmailMessage("");
      }, 1100);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Erro ao enviar proposta por e-mail."
      );
    } finally {
      setSendingEmail(false);
    }
  }

  async function duplicateProposal() {
    if (!proposal) return;

    try {
      setError("");
      setDuplicating(true);

      const duplicated =
        await api.duplicateStandaloneProposal(
          proposal.id
        ) as Proposal;

      if (!duplicated?.id) {
        throw new Error(
          "A proposta foi duplicada, mas o ID não foi retornado."
        );
      }

      navigate(
        `/app/propostas-avulsas/${duplicated.id}`
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Erro ao duplicar proposta."
      );
    } finally {
      setDuplicating(false);
    }
  }

  if (loading) {
    return (
      <section className="sp-editor-page">
        <div className="sp-editor-loading">
          Carregando proposta...
        </div>
      </section>
    );
  }

  if (error || !proposal) {
    return (
      <section className="sp-editor-page">
        <Link
          to="/app/propostas-avulsas"
          className="sp-back-link"
        >
          <ArrowLeft size={16} />
          Voltar para propostas
        </Link>

        <div className="sp-editor-error">
          {error || "Proposta não encontrada."}
        </div>
      </section>
    );
  }

  return (
    <section className="sp-editor-page">
      <div className="sp-editor-topbar">
        <Link
          to="/app/propostas-avulsas"
          className="sp-back-link"
        >
          <ArrowLeft size={17} />
          Propostas Avulsas
        </Link>

        <span className="sp-status-pill">
          {statusLabel(proposal.status)}
        </span>
      </div>

      <header className="sp-editor-header">
        <div>
          <span className="eyebrow">
            PROPOSTA COMERCIAL
          </span>

          <h1>{proposal.proposalNumber}</h1>

          <h2>{proposal.title}</h2>

          <p>
            Monte a composição técnica e comercial antes
            de gerar o documento definitivo.
          </p>
        </div>

        <div className="sp-editor-header-actions">
          {![
            "VINCULADA_PROTOCOLO",
            "CANCELADA",
            "ASSINADA_ELETRONICAMENTE",
          ].includes(proposal.status) && (
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setShowEditModal(true);
              }}
            >
              <Pencil size={17} />
              Editar proposta
            </button>
          )}

          <button
            type="button"
            className="button secondary"
            disabled={duplicating}
            onClick={duplicateProposal}
          >
            {duplicating
              ? "Duplicando..."
              : "Duplicar"}
          </button>

          {[
            "RASCUNHO",
            "GERADA",
            "ENVIADA",
          ].includes(proposal.status) && (
            <button
              type="button"
              className="button secondary"
              onClick={openSendEmailModal}
              disabled={
                sendingEmail ||
                !proposal.items ||
                proposal.items.length === 0
              }
            >
              Enviar proposta
            </button>
          )}

          {[
            "RASCUNHO",
            "GERADA",
            "ENVIADA",
          ].includes(proposal.status) && (
            <button
              type="button"
              className="button primary"
              onClick={() => {
                setApprovalName(
                  proposal.clientName || ""
                );
                setApprovalNote("");
                setFlowActionOpen("APPROVE");
              }}
            >
              Aprovar verbalmente
            </button>
          )}

          {![
            "VINCULADA_PROTOCOLO",
            "CANCELADA",
          ].includes(proposal.status) && (
            <button
              type="button"
              className="button danger-outline"
              onClick={() => {
                setCancelReason("");
                setFlowActionOpen("CANCEL");
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </header>

      <div className="sp-editor-metrics">
        <article>
          <Building2 size={18} />

          <div>
            <span>Cliente</span>
            <strong>{proposal.clientName}</strong>

            <small>
              {[
                proposal.clientCity,
                proposal.clientState,
              ]
                .filter(Boolean)
                .join(" / ") || "Localidade não informada"}
            </small>
          </div>
        </article>

        <article>
          <CalendarDays size={18} />

          <div>
            <span>Criada em</span>
            <strong>{date(proposal.createdAt)}</strong>
            <small>Proposta avulsa</small>
          </div>
        </article>

        <article>
          <Layers3 size={18} />

          <div>
            <span>Serviços</span>
            <strong>
              {proposal.items?.length || 0}
            </strong>
            <small>itens na composição</small>
          </div>
        </article>

        <article className="sp-total-card">
          <CircleDollarSign size={18} />

          <div>
            <span>Valor total</span>
            <strong>
              {money(proposal.totalAmount)}
            </strong>
            <small>valor atual da proposta</small>
          </div>
        </article>
      </div>

      <div className="sp-editor-grid">
        <main className="sp-editor-main">
          <article className="sp-editor-card">
            <div className="sp-card-heading">
              <div className="sp-card-icon">
                <FileText size={19} />
              </div>

              <div>
                <span className="eyebrow">
                  ETAPA 1
                </span>

                <h3>Objeto da proposta</h3>

                <p>
                  Informações comerciais que identificam
                  esta contratação.
                </p>
              </div>

              <span className="sp-stage-done">
                Concluída
              </span>
            </div>

            <div className="sp-object-box">
              <strong>{proposal.title}</strong>

              <p>
                {proposal.objectText ||
                  "Nenhum texto detalhado informado."}
              </p>
            </div>
          </article>

          <article className="sp-editor-card sp-highlight-card">
            <div className="sp-card-heading">
              <div className="sp-card-icon">
                <Layers3 size={19} />
              </div>

              <div>
                <span className="eyebrow">
                  ETAPA 2
                </span>

                <h3>Composição de serviços</h3>

                <p>
                  Adicione serviços do catálogo técnico ou
                  itens comerciais específicos.
                </p>
              </div>
            </div>

            {!proposal.items?.length ? (
              <div className="sp-empty-stage">
                <Layers3 size={31} />

                <strong>
                  Nenhum serviço adicionado
                </strong>

                <p>
                  Selecione serviços do catálogo para
                  compor automaticamente esta proposta.
                </p>

                <div className="sp-empty-actions">
                  <button
                    type="button"
                    className="button primary"
                    onClick={openCatalog}
                  >
                    + Adicionar do catálogo
                  </button>

                  <button
                    type="button"
                    className="button secondary"
                  >
                    + Item manual
                  </button>
                </div>
              </div>
            ) : (
              <div className="sp-proposal-items">
                <div className="sp-items-toolbar">
                  <div>
                    <strong>
                      {proposal.items.length}{" "}
                      {proposal.items.length === 1
                        ? "serviço"
                        : "serviços"}
                    </strong>

                    <span>
                      Composição técnico-comercial
                    </span>
                  </div>

                  <div className="sp-items-toolbar-actions">
                    <button
                      type="button"
                      className="button primary"
                      onClick={openCatalog}
                    >
                      + Catálogo
                    </button>

                    <button
                      type="button"
                      className="button secondary"
                    >
                      + Item manual
                    </button>
                  </div>
                </div>

                {[...proposal.items]
                  .sort(
                    (a, b) =>
                      a.sortOrder - b.sortOrder
                  )
                  .map((item) => (
                    <article
                      key={item.id}
                      className="sp-proposal-item"
                    >
                      <div className="sp-proposal-item-code">
                        {item.acronym ||
                          item.catalogServiceCode ||
                          "ITEM"}
                      </div>

                      <div className="sp-proposal-item-main">
                        <div className="sp-proposal-item-heading">
                          <div>
                            <strong>
                              {item.serviceName}
                            </strong>

                            <span>
                              {item.categoryName ||
                                (item.manualPrice
                                  ? "Item manual"
                                  : "Serviço")}
                            </span>
                          </div>

                          <div className="sp-proposal-item-total">
                            <small>Total</small>
                            <strong>
                              {money(item.totalAmount)}
                            </strong>
                          </div>
                        </div>

                        {(item.summaryDescription ||
                          item.description) && (
                          <p className="sp-proposal-item-description">
                            {item.summaryDescription ||
                              item.description}
                          </p>
                        )}

                        <div className="sp-proposal-item-footer">
                          <div className="sp-proposal-item-calculation">
                            <span>
                              {item.quantity.toLocaleString(
                                "pt-BR",
                                {
                                  maximumFractionDigits:
                                    4,
                                }
                              )}{" "}
                              {item.unitLabel ||
                                "un."}
                            </span>

                            <span>×</span>

                            <strong>
                              {money(item.unitAmount)}
                            </strong>
                          </div>

                          <div className="sp-proposal-item-actions">
                            <button
                              type="button"
                              className="sp-item-action"
                              onClick={() =>
                                openProposalItemEditor(
                                  item
                                )
                              }
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              className="sp-item-action danger"
                              disabled={
                                deletingItemId ===
                                item.id
                              }
                              onClick={() =>
                                removeProposalItem(
                                  item
                                )
                              }
                            >
                              {deletingItemId ===
                              item.id
                                ? "Removendo..."
                                : "Remover"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
            )}
          </article>

          <article className="sp-editor-card">
            <div className="sp-card-heading">
              <div className="sp-card-icon">
                <Paperclip size={19} />
              </div>

              <div>
                <span className="eyebrow">
                  ETAPA 3
                </span>

                <h3>Anexos da proposta</h3>

                <p>
                  Mapas, plantas, planos de voo e demais
                  documentos opcionais.
                </p>
              </div>
            </div>

            {proposal.attachments &&
            proposal.attachments.length > 0 ? (
              <div className="sp-attachments-list">
                <div className="sp-attachments-toolbar">
                  <span>
                    {proposal.attachments.length} anexo(s)
                  </span>

                  <button
                    type="button"
                    className="button secondary"
                    onClick={() =>
                      setAttachmentOpen(true)
                    }
                  >
                    + Adicionar anexo
                  </button>
                </div>

                {proposal.attachments.map(
                  (attachment) => (
                    <article
                      key={attachment.id}
                      className="sp-attachment-row"
                    >
                      <div className="sp-attachment-icon">
                        <Paperclip size={18} />
                      </div>

                      <div className="sp-attachment-content">
                        <strong>
                          {attachment.title}
                        </strong>

                        {attachment.description && (
                          <p>
                            {attachment.description}
                          </p>
                        )}

                        <small>
                          {attachment.type === "ARQUIVO"
                            ? [
                                attachment.fileName,
                                fileSize(attachment.size),
                              ]
                                .filter(Boolean)
                                .join(" · ")
                            : "Documento relacionado à proposta"}
                        </small>
                      </div>

<div className="sp-attachment-actions">
  {attachment.type === "ARQUIVO" &&
    attachment.filePath && (
      <a
        className="button-link"
        href={apiPublicFileUrl(attachment.filePath)}
        target="_blank"
        rel="noreferrer"
      >
        Visualizar
      </a>
    )}

  <button
    type="button"
    className="button-link danger"
    disabled={
      deletingAttachmentId ===
      attachment.id
    }
    onClick={() =>
      deleteAttachment(
        attachment.id
      )
    }
  >
    {deletingAttachmentId ===
    attachment.id
      ? "Removendo..."
      : "Remover"}
  </button>
</div>
                    </article>
                  )
                )}
              </div>
            ) : (
              <div className="sp-empty-stage compact">
                <span>
                  Nenhum anexo relacionado.
                </span>

                <button
                  type="button"
                  className="button secondary"
                  onClick={() =>
                    setAttachmentOpen(true)
                  }
                >
                  + Adicionar anexo
                </button>
              </div>
            )}
          </article>
          <article className="sp-editor-card sp-commercial-card">
            <div className="sp-card-heading">
              <div className="sp-card-icon">
                <CircleDollarSign size={19} />
              </div>

              <div>
                <span className="eyebrow">
                  ETAPA 4
                </span>

                <h3>Condições comerciais</h3>

                <p>
                  Defina validade, prazo, forma de pagamento e ajustes financeiros.
                </p>
              </div>
            </div>

            <div className="sp-commercial-grid">
              <label>
                Validade da proposta
                <div className="sp-input-with-suffix">
                  <input
                    type="number"
                    min="1"
                    value={commercialValidityDays}
                    onChange={(event) =>
                      setCommercialValidityDays(
                        event.target.value
                      )
                    }
                  />

                  <span>dias</span>
                </div>
              </label>

              <label>
                Prazo de execução
                <div className="sp-input-with-suffix">
                  <input
                    type="number"
                    min="1"
                    value={commercialExecutionDays}
                    onChange={(event) =>
                      setCommercialExecutionDays(
                        event.target.value
                      )
                    }
                    placeholder="Ex.: 30"
                  />

                  <span>dias</span>
                </div>
              </label>
            </div>

            <div className="sp-commercial-section">
              <div className="sp-commercial-section-heading">
                <strong>Forma de pagamento</strong>
                <span>
                  Selecione como o valor será apresentado ao cliente.
                </span>
              </div>

              <div className="sp-payment-mode-grid">
                {[
                  {
                    value: "A_VISTA",
                    title: "À vista",
                    description:
                      "Pagamento integral.",
                  },
                  {
                    value: "ENTRADA_PARCELAS",
                    title: "Entrada + parcelas",
                    description:
                      "Entrada inicial e saldo parcelado.",
                  },
                  {
                    value: "PARCELADO",
                    title: "Parcelado",
                    description:
                      "Sem entrada inicial.",
                  },
                  {
                    value: "PERSONALIZADO",
                    title: "Personalizado",
                    description:
                      "Condição comercial livre.",
                  },
                ].map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    className={
                      commercialPaymentMode ===
                      mode.value
                        ? "sp-payment-mode active"
                        : "sp-payment-mode"
                    }
                    onClick={() =>
                      setCommercialPaymentMode(
                        mode.value as
                          | "A_VISTA"
                          | "ENTRADA_PARCELAS"
                          | "PARCELADO"
                          | "PERSONALIZADO"
                      )
                    }
                  >
                    <strong>
                      {mode.title}
                    </strong>

                    <span>
                      {mode.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {commercialPaymentMode ===
              "ENTRADA_PARCELAS" && (
              <div className="sp-commercial-grid three">
                <label>
                  Valor da entrada
                  <div className="sp-money-input">
                    <span>R$</span>

                    <input
                      value={commercialEntryAmount}
                      onChange={(event) =>
                        setCommercialEntryAmount(
                          event.target.value
                        )
                      }
                      placeholder="0,00"
                    />
                  </div>
                </label>

                <label>
                  Quantidade de parcelas
                  <input
                    type="number"
                    min="1"
                    value={commercialInstallmentQty}
                    onChange={(event) =>
                      setCommercialInstallmentQty(
                        event.target.value
                      )
                    }
                  />
                </label>

                <div className="sp-commercial-readonly">
                  <span>Valor estimado/parcela</span>
                  <strong>
                    {money(
                      commercialInstallmentPreview()
                    )}
                  </strong>
                </div>
              </div>
            )}

            {commercialPaymentMode ===
              "PARCELADO" && (
              <div className="sp-commercial-grid">
                <label>
                  Quantidade de parcelas
                  <input
                    type="number"
                    min="1"
                    value={commercialInstallmentQty}
                    onChange={(event) =>
                      setCommercialInstallmentQty(
                        event.target.value
                      )
                    }
                  />
                </label>

                <div className="sp-commercial-readonly">
                  <span>Valor estimado/parcela</span>
                  <strong>
                    {money(
                      commercialInstallmentPreview()
                    )}
                  </strong>
                </div>
              </div>
            )}

            <div className="sp-commercial-section">
              <div className="sp-commercial-section-heading">
                <strong>Ajustes financeiros</strong>
                <span>
                  Descontos e acréscimos aplicados ao subtotal dos serviços.
                </span>
              </div>

              <div className="sp-commercial-grid three">
                <label>
                  Desconto
                  <div className="sp-money-input">
                    <span>R$</span>

                    <input
                      value={commercialDiscount}
                      onChange={(event) =>
                        setCommercialDiscount(
                          event.target.value
                        )
                      }
                      placeholder="0,00"
                    />
                  </div>
                </label>

                <label>
                  Acréscimo
                  <div className="sp-money-input">
                    <span>R$</span>

                    <input
                      value={commercialAddition}
                      onChange={(event) =>
                        setCommercialAddition(
                          event.target.value
                        )
                      }
                      placeholder="0,00"
                    />
                  </div>
                </label>

                <div className="sp-commercial-total-preview">
                  <span>Total final</span>

                  <strong>
                    {money(
                      commercialTotalPreview()
                    )}
                  </strong>
                </div>
              </div>
            </div>

            <div className="sp-commercial-section">
              <div className="sp-commercial-section-heading">
                <strong>Texto da condição de pagamento</strong>
                <span>
                  O texto será utilizado no PDF da proposta.
                </span>
              </div>

              {commercialPaymentMode !==
                "PERSONALIZADO" && (
                <div className="sp-generated-payment">
                  {generatedPaymentText()}
                </div>
              )}

              {commercialPaymentMode ===
                "PERSONALIZADO" && (
                <textarea
                  rows={4}
                  value={commercialPaymentText}
                  onChange={(event) =>
                    setCommercialPaymentText(
                      event.target.value
                    )
                  }
                  placeholder="Ex.: 30% na contratação, 40% após a etapa de campo e 30% na entrega final."
                />
              )}
            </div>

            <div className="sp-commercial-section">
              <div className="sp-commercial-grid">
                <label>
                  Texto complementar do prazo
                  <textarea
                    rows={3}
                    value={commercialExecutionText}
                    onChange={(event) =>
                      setCommercialExecutionText(
                        event.target.value
                      )
                    }
                    placeholder="Opcional. Ex.: prazo contado após disponibilização dos documentos e acesso à área."
                  />
                </label>

                <label>
                  Observações da proposta
                  <textarea
                    rows={3}
                    value={commercialNotes}
                    onChange={(event) =>
                      setCommercialNotes(
                        event.target.value
                      )
                    }
                    placeholder="Condições adicionais, responsabilidades ou observações comerciais."
                  />
                </label>
              </div>
            </div>

            <div className="sp-commercial-footer">
              <div>
                <span>Total da proposta</span>

                <strong>
                  {money(
                    commercialTotalPreview()
                  )}
                </strong>
              </div>

              <button
                type="button"
                className="button primary"
                disabled={commercialSaving}
                onClick={saveCommercialConditions}
              >
                {commercialSaving
                  ? "Salvando..."
                  : "Salvar condições comerciais"}
              </button>
            </div>
          </article>

          <article className="sp-editor-card sp-history-card">
            <div className="sp-card-heading">
              <div className="sp-card-icon">
                <FileText size={19} />
              </div>

              <div>
                <span className="eyebrow">
                  HISTÓRICO
                </span>

                <h3>Timeline da proposta</h3>

                <p>
                  Registro cronológico das ações,
                  alterações e decisões comerciais.
                </p>
              </div>
            </div>

            {proposal.events &&
            proposal.events.length > 0 ? (
              <div className="sp-history-list">
                {[...proposal.events]
                  .sort(
                    (a, b) =>
                      new Date(
                        b.createdAt
                      ).getTime() -
                      new Date(
                        a.createdAt
                      ).getTime()
                  )
                  .map((event) => (
                    <article
                      key={event.id}
                      className="sp-history-item"
                    >
                      <div className="sp-history-marker">
                        <span />
                      </div>

                      <div className="sp-history-content">
                        <div className="sp-history-heading">
                          <strong>
                            {event.title}
                          </strong>

                          <time>
                            {dateTime(
                              event.createdAt
                            )}
                          </time>
                        </div>

                        {event.description && (
                          <p>
                            {event.description}
                          </p>
                        )}

                        <div className="sp-history-meta">
                          {event.actorName && (
                            <span>
                              Por {event.actorName}
                            </span>
                          )}

                          {event.actorEmail && (
                            <span>
                              {event.actorEmail}
                            </span>
                          )}

                          {event.recipient && (
                            <span>
                              Destinatário:{" "}
                              {event.recipient}
                            </span>
                          )}

                          <span className="sp-history-type">
                            {event.eventType}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
            ) : (
              <div className="sp-history-empty">
                Nenhum evento registrado nesta proposta.
              </div>
            )}
          </article>
        </main>

        <aside className="sp-editor-aside">
          <article className="sp-summary-card">
            <span className="eyebrow">
              RESUMO COMERCIAL
            </span>

            <h3>Composição financeira</h3>

            <div className="sp-summary-row">
              <span>Subtotal</span>
              <strong>
                {money(proposal.subtotalAmount)}
              </strong>
            </div>

            <div className="sp-summary-row">
              <span>Descontos</span>
              <strong>
                - {money(proposal.discountAmount)}
              </strong>
            </div>

            <div className="sp-summary-row">
              <span>Acréscimos</span>
              <strong>
                {money(proposal.additionAmount)}
              </strong>
            </div>

            <div className="sp-summary-total">
              <span>Total da proposta</span>
              <strong>
                {money(proposal.totalAmount)}
              </strong>
            </div>

            <button
              type="button"
              className="button primary full"
              disabled={
                generatingPdf ||
                !proposal.items ||
                proposal.items.length === 0
              }
              onClick={generateProposalPdf}
            >
              {generatingPdf
                ? "Gerando PDF..."
                : proposal.generatedPdfName
                  ? "Regenerar PDF"
                  : "Gerar PDF"}
            </button>

            {proposal.generatedPdfName ? (
              <div className="sp-generated-document">
                <div className="sp-generated-document-icon">
                  <FileText size={18} />
                </div>

                <div className="sp-generated-document-content">
                  <span>Documento gerado</span>

                  <strong>
                    {proposal.generatedPdfName}
                  </strong>

                  <div className="sp-generated-document-actions">
                    <button
                      type="button"
                      className="sp-document-action"
                      disabled={openingPdf}
                      onClick={viewProposalPdf}
                    >
                      {openingPdf
                        ? "Abrindo..."
                        : "Visualizar"}
                    </button>

                    <button
                      type="button"
                      className="sp-document-action"
                      disabled={downloadingPdf}
                      onClick={downloadProposalPdf}
                    >
                      {downloadingPdf
                        ? "Baixando..."
                        : "Baixar"}
                    </button>
                  </div>

                  {proposal.generatedAt && (
                    <small>
                      Gerado em{" "}
                      {new Intl.DateTimeFormat(
                        "pt-BR",
                        {
                          dateStyle: "short",
                          timeStyle: "short",
                        }
                      ).format(
                        new Date(
                          proposal.generatedAt
                        )
                      )}
                    </small>
                  )}
                </div>
              </div>
            ) : (
              <small className="sp-summary-help">
                Adicione ao menos um serviço para liberar
                a geração do documento.
              </small>
            )}

            {pdfMessage && (
              <div className="sp-pdf-success">
                {pdfMessage}
              </div>
            )}
          </article>
        </aside>
      </div>

      {attachmentOpen && (
        <div
          className="sp-catalog-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setAttachmentOpen(false);
            }
          }}
        >
          <section className="sp-attachment-modal">
            <header className="sp-modal-heading">
              <div>
                <span className="eyebrow">
                  ANEXOS
                </span>

                <h2>
                  Adicionar anexo à proposta
                </h2>

                <p>
                  Relacione mapas, plantas,
                  planos de voo e demais
                  documentos que acompanharão
                  esta proposta.
                </p>
              </div>

              <button
                type="button"
                className="sp-modal-close"
                onClick={() =>
                  setAttachmentOpen(false)
                }
              >
                ×
              </button>
            </header>

            <div className="sp-attachment-form">
              <label>
                Título do documento *
                <input
                  type="text"
                  value={attachmentTitle}
                  onChange={(event) =>
                    setAttachmentTitle(
                      event.target.value
                    )
                  }
                  placeholder="Ex.: Mapa georreferenciado das parcelas"
                />
              </label>

              <label>
                Descrição
                <textarea
                  value={attachmentDescription}
                  onChange={(event) =>
                    setAttachmentDescription(
                      event.target.value
                    )
                  }
                  placeholder="Ex.: Mapa integrante desta proposta comercial."
                  rows={4}
                />
              </label>

              <div className="sp-attachment-mode-section">
                <span className="sp-attachment-field-label">
                  Tipo de anexo
                </span>

                <div className="sp-attachment-mode-grid">
                  <button
                    type="button"
                    className={
                      attachmentMode === "LISTADO"
                        ? "sp-attachment-mode active"
                        : "sp-attachment-mode"
                    }
                    onClick={() => {
                      setAttachmentMode("LISTADO");
                      setAttachmentFile(null);
                    }}
                  >
                    <strong>
                      Apenas relacionar
                    </strong>

                    <span>
                      O documento será listado
                      na proposta e no PDF.
                    </span>
                  </button>

                  <button
                    type="button"
                    className={
                      attachmentMode === "ARQUIVO"
                        ? "sp-attachment-mode active"
                        : "sp-attachment-mode"
                    }
                    onClick={() =>
                      setAttachmentMode("ARQUIVO")
                    }
                  >
                    <strong>
                      Anexar arquivo
                    </strong>

                    <span>
                      O arquivo ficará armazenado
                      no SIS Amazônika.
                    </span>
                  </button>
                </div>
              </div>

              {attachmentMode === "ARQUIVO" && (
                <label className="sp-file-field">
                  Arquivo *

                  <div className="sp-file-picker">
                    <Paperclip size={22} />

                    <div>
                      <strong>
                        {attachmentFile
                          ? attachmentFile.name
                          : "Selecionar arquivo"}
                      </strong>

                      <span>
                        {attachmentFile
                          ? `${(
                              attachmentFile.size /
                              1024 /
                              1024
                            ).toFixed(2)} MB`
                          : "PDF, PNG, JPG, JPEG ou WEBP · máximo 25 MB"}
                      </span>
                    </div>

                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                      onChange={(event) =>
                        setAttachmentFile(
                          event.target.files?.[0] ||
                          null
                        )
                      }
                    />
                  </div>
                </label>
              )}

              <div className="sp-attachment-info">
                <Paperclip size={18} />

                <div>
                  <strong>
                    Anexo relacionado
                  </strong>

                  <span>
                    {attachmentMode === "ARQUIVO"
                      ? "O documento será relacionado no PDF e o arquivo ficará armazenado junto à proposta."
                      : "O documento será relacionado no PDF da proposta, sem necessidade de enviar um arquivo."}
                  </span>
                </div>
              </div>
            </div>

            <footer className="sp-modal-footer">
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setAttachmentOpen(false);
                  setAttachmentTitle("");
                  setAttachmentDescription("");
                  setAttachmentMode("LISTADO");
                  setAttachmentFile(null);
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="button primary"
                disabled={
                  attachmentSaving ||
                  !attachmentTitle.trim()
                }
                onClick={saveAttachment}
              >
                {attachmentSaving
                  ? "Adicionando..."
                  : "Adicionar anexo"}
              </button>
            </footer>
          </section>
        </div>
      )}

      {catalogOpen && (
        <div
          className="sp-catalog-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setCatalogOpen(false);
              setSelectedCatalogService(
                null
              );
            }
          }}
        >
          <section className="sp-catalog-modal">
            <header className="sp-catalog-modal-header">
              <div>
                <span className="eyebrow">
                  CATÁLOGO TÉCNICO-COMERCIAL
                </span>

                <h2>
                  {selectedCatalogService
                    ? "Configurar serviço"
                    : "Adicionar serviço"}
                </h2>

                <p>
                  {selectedCatalogService
                    ? "Revise quantidade, descrição e valor antes de adicionar."
                    : "Escolha um serviço cadastrado para compor a proposta."}
                </p>
              </div>

              <button
                type="button"
                className="sp-edit-close"
                onClick={() => {
                  if (
                    selectedCatalogService
                  ) {
                    setSelectedCatalogService(
                      null
                    );
                  } else {
                    setCatalogOpen(false);
                  }
                }}
              >
                ×
              </button>
            </header>

            {!selectedCatalogService ? (
              <>
                <div className="sp-catalog-filters">
                  <input
                    type="search"
                    placeholder="Buscar por nome, código ou sigla..."
                    value={catalogSearch}
                    onChange={(event) =>
                      setCatalogSearch(
                        event.target.value
                      )
                    }
                  />

                  <select
                    value={catalogCategoryId}
                    onChange={(event) =>
                      setCatalogCategoryId(
                        event.target.value ===
                          "all"
                          ? "all"
                          : Number(
                              event.target.value
                            )
                      )
                    }
                  >
                    <option value="all">
                      Todas as categorias
                    </option>

                    {Array.from(
                      new Map(
                        catalogServices.map(
                          (service) => [
                            service.category.id,
                            service.category,
                          ]
                        )
                      ).values()
                    ).map((category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sp-catalog-list">
                  {catalogLoading ? (
                    <div className="sp-catalog-empty">
                      Carregando catálogo...
                    </div>
                  ) : (
                    (() => {
                      const search =
                        catalogSearch
                          .trim()
                          .toLowerCase();

                      const filtered =
                        catalogServices.filter(
                          (service) => {
                            const categoryMatches =
                              catalogCategoryId ===
                                "all" ||
                              service.category.id ===
                                catalogCategoryId;

                            const searchMatches =
                              !search ||
                              service.name
                                .toLowerCase()
                                .includes(search) ||
                              service.code
                                .toLowerCase()
                                .includes(search) ||
                              (
                                service.acronym ||
                                ""
                              )
                                .toLowerCase()
                                .includes(search);

                            return (
                              service.active &&
                              categoryMatches &&
                              searchMatches
                            );
                          }
                        );

                      if (
                        filtered.length === 0
                      ) {
                        return (
                          <div className="sp-catalog-empty">
                            Nenhum serviço encontrado.
                          </div>
                        );
                      }

                      const groups =
                        filtered.reduce<
                          Record<
                            string,
                            CatalogService[]
                          >
                        >(
                          (
                            result,
                            service
                          ) => {
                            const key =
                              service.category
                                .name;

                            if (!result[key]) {
                              result[key] = [];
                            }

                            result[key].push(
                              service
                            );

                            return result;
                          },
                          {}
                        );

                      return Object.entries(
                        groups
                      ).map(
                        ([
                          categoryName,
                          services,
                        ]) => (
                          <section
                            key={
                              categoryName
                            }
                            className="sp-catalog-group"
                          >
                            <h3>
                              {categoryName}
                            </h3>

                            {services.map(
                              (service) => (
                                <button
                                  key={
                                    service.id
                                  }
                                  type="button"
                                  className="sp-catalog-service"
                                  onClick={() =>
                                    selectCatalogService(
                                      service
                                    )
                                  }
                                >
                                  <div className="sp-catalog-service-code">
                                    {service.acronym ||
                                      service.code}
                                  </div>

                                  <div className="sp-catalog-service-info">
                                    <strong>
                                      {
                                        service.name
                                      }
                                    </strong>

                                    <span>
                                      {service.shortDescription ||
                                        pricingModeLabel(
                                          service.pricingMode
                                        )}
                                    </span>
                                  </div>

                                  <div className="sp-catalog-service-price">
                                    {service.pricingMode ===
                                    "SOB_CONSULTA" ? (
                                      <>
                                        <strong>
                                          Sob consulta
                                        </strong>
                                      </>
                                    ) : service.pricingMode ===
                                      "POR_FAIXA" ? (
                                      <>
                                        <small>
                                          Faixas
                                        </small>
                                        <strong>
                                          {
                                            service
                                              .pricingTiers
                                              .filter(
                                                (
                                                  tier
                                                ) =>
                                                  tier.active
                                              )
                                              .length
                                          }{" "}
                                          cadastrada(s)
                                        </strong>
                                      </>
                                    ) : (
                                      <>
                                        <small>
                                          {pricingModeLabel(
                                            service.pricingMode
                                          )}
                                        </small>

                                        <strong>
                                          {money(
                                            service.baseAmount
                                          )}
                                          {service.unitLabel
                                            ? ` / ${service.unitLabel}`
                                            : ""}
                                        </strong>
                                      </>
                                    )}
                                  </div>

                                  <span className="sp-catalog-add">
                                    Adicionar
                                  </span>
                                </button>
                              )
                            )}
                          </section>
                        )
                      );
                    })()
                  )}
                </div>
              </>
            ) : (
              <div className="sp-catalog-config">
                <div className="sp-catalog-selected">
                  <div className="sp-catalog-selected-code">
                    {selectedCatalogService.acronym ||
                      selectedCatalogService.code}
                  </div>

                  <div>
                    <span>
                      {
                        selectedCatalogService
                          .category.name
                      }
                    </span>

                    <h3>
                      {
                        selectedCatalogService.name
                      }
                    </h3>

                    <p>
                      {pricingModeLabel(
                        selectedCatalogService.pricingMode
                      )}
                    </p>
                  </div>
                </div>

                <div className="sp-catalog-config-grid">
                  <label>
                    Quantidade *
                    <input
                      inputMode="decimal"
                      value={
                        catalogQuantity
                      }
                      onChange={(event) =>
                        setCatalogQuantity(
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Unidade
                    <input
                      value={
                        selectedCatalogService.unitLabel ||
                        "Serviço"
                      }
                      disabled
                    />
                  </label>

                  <label>
                    Valor unitário
                    <input
                      value={
                        catalogUnitAmount
                      }
                      onChange={(event) =>
                        setCatalogUnitAmount(
                          event.target.value
                        )
                      }
                      disabled={
                        selectedCatalogService.pricingMode ===
                          "POR_FAIXA" ||
                        (!selectedCatalogService.allowManualPrice &&
                          selectedCatalogService.pricingMode !==
                            "SOB_CONSULTA")
                      }
                    />
                  </label>

                  <div className="sp-catalog-preview">
                    <span>
                      Total estimado
                    </span>

                    <strong>
                      {money(
                        catalogPreviewTotal()
                      )}
                    </strong>
                  </div>

                  <label className="full">
                    Descrição na proposta
                    <textarea
                      rows={6}
                      value={
                        catalogDescription
                      }
                      onChange={(event) =>
                        setCatalogDescription(
                          event.target.value
                        )
                      }
                    />
                  </label>
                </div>

                {selectedCatalogService.pricingMode ===
                  "POR_FAIXA" && (
                  <div className="sp-tier-notice">
                    O preço será definido
                    automaticamente pela faixa
                    correspondente à quantidade
                    informada.
                  </div>
                )}

                <footer className="sp-catalog-config-footer">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={
                      addingCatalogItem
                    }
                    onClick={() =>
                      setSelectedCatalogService(
                        null
                      )
                    }
                  >
                    Voltar
                  </button>

                  <button
                    type="button"
                    className="button primary"
                    disabled={
                      addingCatalogItem
                    }
                    onClick={
                      addCatalogItem
                    }
                  >
                    {addingCatalogItem
                      ? "Adicionando..."
                      : "Adicionar à proposta"}
                  </button>
                </footer>
              </div>
            )}
          </section>
        </div>
      )}

      {editingItem && (
        <div
          className="sp-edit-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !itemEditSaving
            ) {
              closeProposalItemEditor();
            }
          }}
        >
          <section className="sp-edit-modal">
            <header className="sp-edit-modal-header">
              <div>
                <span className="eyebrow">
                  SERVIÇO DA PROPOSTA
                </span>

                <h2>
                  Editar serviço
                </h2>

                <p>
                  As alterações serão aplicadas somente a esta
                  proposta e não modificarão o catálogo original.
                </p>
              </div>

              <button
                type="button"
                className="sp-edit-close"
                disabled={itemEditSaving}
                onClick={
                  closeProposalItemEditor
                }
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <div className="sp-edit-form">
              <label className="full">
                Nome do serviço *
                <input
                  type="text"
                  value={
                    itemEditForm.serviceName
                  }
                  onChange={(event) =>
                    setItemEditForm(
                      (current) => ({
                        ...current,
                        serviceName:
                          event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label className="full">
                Descrição resumida
                <textarea
                  rows={3}
                  value={
                    itemEditForm
                      .summaryDescription
                  }
                  onChange={(event) =>
                    setItemEditForm(
                      (current) => ({
                        ...current,
                        summaryDescription:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Resumo objetivo para aparecer na tabela comercial do PDF."
                />
              </label>

              <label className="full">
                Descrição Comercial
                <textarea
                  rows={7}
                  value={
                    itemEditForm
                      .commercialDescription
                  }
                  onChange={(event) =>
                    setItemEditForm(
                      (current) => ({
                        ...current,
                        commercialDescription:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Apresente o serviço em linguagem comercial, seu objetivo, abrangência e principais entregas."
                />
              </label>

              <label className="full">
                Descrição Técnica
                <textarea
                  rows={9}
                  value={
                    itemEditForm
                      .technicalDescription
                  }
                  onChange={(event) =>
                    setItemEditForm(
                      (current) => ({
                        ...current,
                        technicalDescription:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Metodologia, atividades, critérios técnicos, levantamentos, produtos e procedimentos."
                />
              </label>

              <label className="full">
                Fundamentação Legal
                <textarea
                  rows={7}
                  value={
                    itemEditForm.legalText
                  }
                  onChange={(event) =>
                    setItemEditForm(
                      (current) => ({
                        ...current,
                        legalText:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Leis, decretos, resoluções, instruções normativas e demais referências aplicáveis."
                />
              </label>

              <label>
                Quantidade *
                <input
                  inputMode="decimal"
                  value={
                    itemEditForm.quantity
                  }
                  onChange={(event) =>
                    setItemEditForm(
                      (current) => ({
                        ...current,
                        quantity:
                          event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label>
                Unidade
                <input
                  type="text"
                  value={
                    itemEditForm.unitLabel
                  }
                  onChange={(event) =>
                    setItemEditForm(
                      (current) => ({
                        ...current,
                        unitLabel:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Serviço, ha, km, un..."
                />
              </label>

              <label>
                Valor unitário
                <input
                  inputMode="decimal"
                  value={
                    itemEditForm.unitAmount
                  }
                  onChange={(event) =>
                    setItemEditForm(
                      (current) => ({
                        ...current,
                        unitAmount:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="0,00"
                />
              </label>

              <div>
                <span
                  style={{
                    display: "block",
                    marginBottom: 6,
                    color: "#34463d",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  Total do serviço
                </span>

                <strong
                  style={{
                    display: "block",
                    padding: "11px 12px",
                    borderRadius: 11,
                    background: "#edf6f1",
                    color: "#146047",
                  }}
                >
                  {money(
                    Math.round(
                      Math.max(
                        0,
                        numberFromInput(
                          itemEditForm.quantity
                        )
                      ) *
                        Math.max(
                          0,
                          currencyInputToCents(
                            itemEditForm.unitAmount
                          )
                        )
                    )
                  )}
                </strong>
              </div>
            </div>

            <footer className="sp-edit-modal-footer">
              <button
                type="button"
                className="button secondary"
                disabled={itemEditSaving}
                onClick={
                  closeProposalItemEditor
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className="button primary"
                disabled={itemEditSaving}
                onClick={
                  saveProposalItemEditor
                }
              >
                {itemEditSaving
                  ? "Salvando..."
                  : "Salvar serviço"}
              </button>
            </footer>
          </section>
        </div>
      )}

      {flowActionOpen === "APPROVE" && (
        <div
          className="sp-edit-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget &&
              !flowSaving
            ) {
              setFlowActionOpen(null);
            }
          }}
        >
          <section className="sp-flow-modal">
            <header className="sp-edit-modal-header">
              <div>
                <span className="eyebrow">
                  APROVAÇÃO COMERCIAL
                </span>

                <h2>
                  Registrar aprovação verbal
                </h2>

                <p>
                  Confirme quem autorizou a proposta.
                  O registro ficará armazenado no
                  histórico comercial.
                </p>
              </div>

              <button
                type="button"
                className="sp-edit-close"
                disabled={flowSaving}
                onClick={() =>
                  setFlowActionOpen(null)
                }
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <div className="sp-flow-body">
              <div className="sp-flow-notice success">
                <strong>
                  {proposal.proposalNumber}
                </strong>

                <span>
                  {proposal.title}
                </span>

                <b>
                  {money(
                    proposal.totalAmount
                  )}
                </b>
              </div>

              <label>
                Nome de quem aprovou *
                <input
                  autoFocus
                  value={approvalName}
                  onChange={(event) =>
                    setApprovalName(
                      event.target.value
                    )
                  }
                  placeholder="Nome completo"
                />
              </label>

              <label>
                Observação da aprovação
                <textarea
                  rows={5}
                  value={approvalNote}
                  onChange={(event) =>
                    setApprovalNote(
                      event.target.value
                    )
                  }
                  placeholder="Ex.: aprovação confirmada por telefone em reunião com o cliente."
                />
              </label>

              <div className="sp-flow-warning">
                Esta ação alterará o status para
                <strong>
                  {" "}Aprovada verbalmente
                </strong>
                .
              </div>
            </div>

            <footer className="sp-edit-modal-footer">
              <button
                type="button"
                className="button secondary"
                disabled={flowSaving}
                onClick={() =>
                  setFlowActionOpen(null)
                }
              >
                Voltar
              </button>

              <button
                type="button"
                className="button primary"
                disabled={
                  flowSaving ||
                  !approvalName.trim()
                }
                onClick={approveVerbally}
              >
                {flowSaving
                  ? "Registrando..."
                  : "Confirmar aprovação"}
              </button>
            </footer>
          </section>
        </div>
      )}

      {flowActionOpen === "CANCEL" && (
        <div
          className="sp-edit-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget &&
              !flowSaving
            ) {
              setFlowActionOpen(null);
            }
          }}
        >
          <section className="sp-flow-modal">
            <header className="sp-edit-modal-header">
              <div>
                <span className="eyebrow">
                  CONTROLE COMERCIAL
                </span>

                <h2>
                  Cancelar proposta
                </h2>

                <p>
                  A proposta será preservada no histórico,
                  mas ficará bloqueada para novas
                  alterações comerciais.
                </p>
              </div>

              <button
                type="button"
                className="sp-edit-close"
                disabled={flowSaving}
                onClick={() =>
                  setFlowActionOpen(null)
                }
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <div className="sp-flow-body">
              <div className="sp-flow-notice danger">
                <strong>
                  {proposal.proposalNumber}
                </strong>

                <span>
                  {proposal.clientName}
                </span>

                <b>
                  {money(
                    proposal.totalAmount
                  )}
                </b>
              </div>

              <label>
                Motivo do cancelamento
                <textarea
                  autoFocus
                  rows={6}
                  value={cancelReason}
                  onChange={(event) =>
                    setCancelReason(
                      event.target.value
                    )
                  }
                  placeholder="Ex.: cliente desistiu da contratação, orçamento substituído, serviço não será executado..."
                />
              </label>

              <div className="sp-flow-warning danger">
                O cancelamento ficará registrado
                permanentemente na timeline da proposta.
              </div>
            </div>

            <footer className="sp-edit-modal-footer">
              <button
                type="button"
                className="button secondary"
                disabled={flowSaving}
                onClick={() =>
                  setFlowActionOpen(null)
                }
              >
                Voltar
              </button>

              <button
                type="button"
                className="button danger"
                disabled={flowSaving}
                onClick={cancelProposal}
              >
                {flowSaving
                  ? "Cancelando..."
                  : "Confirmar cancelamento"}
              </button>
            </footer>
          </section>
        </div>
      )}

      {sendEmailOpen && (
        <div
          className="sp-edit-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget &&
              !sendingEmail
            ) {
              setSendEmailOpen(false);
            }
          }}
        >
          <section className="sp-edit-modal sp-send-email-modal">
            <header className="sp-edit-modal-header">
              <div>
                <span className="eyebrow">
                  ENVIO DA PROPOSTA
                </span>

                <h2>
                  Enviar proposta por e-mail
                </h2>

                <p>
                  O PDF oficial será regenerado antes do envio
                  e encaminhado ao destinatário como anexo.
                </p>
              </div>

              <button
                type="button"
                className="sp-edit-close"
                disabled={sendingEmail}
                onClick={() =>
                  setSendEmailOpen(false)
                }
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <div className="sp-edit-form">
              <label className="full">
                Destinatário *
                <input
                  type="email"
                  autoFocus
                  placeholder="cliente@empresa.com.br"
                  value={sendEmailAddress}
                  onChange={(event) =>
                    setSendEmailAddress(
                      event.target.value
                    )
                  }
                  disabled={sendingEmail}
                />
              </label>

              <div className="full sp-send-email-summary">
                <div>
                  <span>Proposta</span>
                  <strong>
                    {proposal.proposalNumber}
                  </strong>
                </div>

                <div>
                  <span>Cliente</span>
                  <strong>
                    {proposal.clientName}
                  </strong>
                </div>

                <div>
                  <span>Valor</span>
                  <strong>
                    {money(
                      proposal.totalAmount
                    )}
                  </strong>
                </div>
              </div>

              {sendEmailMessage && (
                <div className="full sp-send-email-success">
                  {sendEmailMessage}
                </div>
              )}
            </div>

            <footer className="sp-edit-modal-footer">
              <button
                type="button"
                className="button secondary"
                disabled={sendingEmail}
                onClick={() =>
                  setSendEmailOpen(false)
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className="button primary"
                disabled={
                  sendingEmail ||
                  !sendEmailAddress.trim()
                }
                onClick={sendProposalEmail}
              >
                {sendingEmail
                  ? "Enviando..."
                  : "Enviar proposta"}
              </button>
            </footer>
          </section>
        </div>
      )}

      {showEditModal && (
        <div
          className="sp-edit-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowEditModal(false);
            }
          }}
        >
          <section className="sp-edit-modal">
            <header className="sp-edit-modal-header">
              <div>
                <span className="eyebrow">
                  PROPOSTA COMERCIAL
                </span>

                <h2>Editar proposta</h2>

                <p>
                  Atualize os dados básicos antes de
                  continuar a composição comercial.
                </p>
              </div>

              <button
                type="button"
                className="sp-edit-close"
                onClick={() => {
                  setShowEditModal(false);
                }}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <div className="sp-edit-form">
              <label className="full">
                Nome / Razão Social *
                <input
                  value={editForm.clientName}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      clientName:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                E-mail
                <input
                  type="email"
                  value={editForm.clientEmail}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      clientEmail:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Telefone
                <input
                  value={editForm.clientPhone}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      clientPhone:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                WhatsApp
                <input
                  value={editForm.clientWhatsapp}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      clientWhatsapp:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Município
                <input
                  value={editForm.clientCity}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      clientCity:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                UF
                <input
                  maxLength={2}
                  value={editForm.clientState}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      clientState:
                        event.target.value.toUpperCase(),
                    }))
                  }
                />
              </label>

              <label className="full">
                Objeto resumido *
                <input
                  value={editForm.title}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      title:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label className="full">
                Texto do objeto
                <textarea
                  rows={5}
                  value={editForm.objectText}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      objectText:
                        event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <footer className="sp-edit-modal-footer">
              <button
                type="button"
                className="button secondary"
                disabled={editing}
                onClick={() => {
                  setShowEditModal(false);
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="button primary"
                disabled={editing}
                onClick={saveProposalData}
              >
                {editing
                  ? "Salvando..."
                  : "Salvar alterações"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
