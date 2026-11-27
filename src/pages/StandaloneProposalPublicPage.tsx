import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FileDown, ShieldCheck } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3333";

type PublicStandaloneProposal = {
  proposalNumber: string;
  title: string;
  clientName: string;
  totalAmount: number;
  validUntil: string | null;
  generatedAt: string | null;
  status: string;
  sha256: string;
  downloadUrl: string;
};

const date = (value: string | null) =>
  value ? new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Belem",
  }).format(new Date(value)) : "—";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(value / 100);

export default function StandaloneProposalPublicPage() {
  const { token } = useParams();
  const [proposal, setProposal] = useState<PublicStandaloneProposal | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      setProposal(null);
      try {
        if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
          throw new Error("Link de verificação inválido.");
        }
        const response = await fetch(
          `${API_URL}/public/standalone-proposals/${encodeURIComponent(token)}`,
          { signal: controller.signal, cache: "no-store" }
        );
        if (!response.ok) throw new Error(
          response.status === 404
            ? "Proposta não encontrada ou ainda não emitida."
            : "Não foi possível verificar este documento."
        );
        const data = await response.json() as PublicStandaloneProposal;
        setProposal(data);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Falha na consulta.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [token]);

  return (
    <main style={{ minHeight: "100vh", background: "#F3F7F5", padding: "40px 16px",
      color: "#17231F", fontFamily: "Arial, sans-serif" }}>
      <section style={{ maxWidth: 700, margin: "0 auto", background: "#fff",
        borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 34px #123E2714" }}>
        <header style={{ background: "#155E49", color: "white", padding: "30px 32px",
          borderTop: "6px solid #C5A045" }}>
          <small style={{ letterSpacing: 2 }}>AMAZONIKA ENGENHARIA LTDA</small>
          <h1 style={{ margin: "14px 0 0", fontSize: 24 }}>Verificação e rastreabilidade</h1>
          <p style={{ opacity: 0.8 }}>Consulta pública de proposta comercial emitida</p>
        </header>
        <div style={{ padding: 32 }}>
          {loading && <p>Consultando documento...</p>}
          {error && <p role="alert">{error}</p>}
          {proposal && (
            <>
              <p style={{ display: "flex", alignItems: "center", gap: 8,
                color: "#155E49", fontWeight: 700 }}>
                <ShieldCheck size={22}/> Documento registrado no sistema
              </p>
              <h2 style={{ color: "#155E49" }}>{proposal.proposalNumber}</h2>
              <p><strong>Objeto:</strong> {proposal.title}</p>
              <p><strong>Destinatário:</strong> {proposal.clientName}</p>
              <p><strong>Valor:</strong> {money(proposal.totalAmount)}</p>
              <p><strong>Emissão:</strong> {date(proposal.generatedAt)}</p>
              <p><strong>Validade:</strong> {date(proposal.validUntil)}</p>
              <p><strong>Situação atual:</strong> {proposal.status.replace(/_/g, " ")}</p>
              <p style={{ overflowWrap: "anywhere", fontSize: 12, color: "#62776D" }}>
                <strong>SHA-256 do PDF:</strong> {proposal.sha256}
              </p>
              <a href={`${API_URL}${proposal.downloadUrl}`}
                style={{ display: "inline-flex", alignItems: "center", gap: 9,
                  marginTop: 18, padding: "14px 22px", background: "#155E49",
                  borderRadius: 7, color: "white", textDecoration: "none", fontWeight: 700 }}>
                <FileDown size={20}/> Baixar PDF oficial
              </a>
              <p style={{ fontSize: 12, color: "#64736C", marginTop: 20 }}>
                A consulta confirma a existência do documento registrado. Confira o arquivo
                baixado e seu hash para verificar sua integridade.
              </p>
            </>
          )}
          <div style={{ marginTop: 24 }}><Link to="/">Voltar ao início</Link></div>
        </div>
      </section>
    </main>
  );
}
