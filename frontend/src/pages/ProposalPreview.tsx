import {
  ArrowLeft,
  CheckCircle,
  Download,
  ExternalLink,
  Mail,
  MessageCircle,
  Pencil,
  Printer,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ProposalDocument } from "../components/proposals/ProposalDocument";
import { StatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { useMeta } from "../context/MetaContext";
import { useToast } from "../context/ToastContext";
import { api, buildUrl, downloadFile, getStoredToken } from "../lib/api";
import { PROPOSAL_STATUS_LABELS, formatCurrency } from "../lib/format";
import type { Proposal, ProposalContent } from "../lib/types";

export function ProposalPreview() {
  const { id } = useParams();
  const { user } = useAuth();
  const { meta } = useMeta();
  const toast = useToast();
  const navigate = useNavigate();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const record = await api.get<Proposal>(`/proposals/${id}`);
      setProposal(record);
    } catch (err) {
      toast.error("Could not load proposal", err instanceof Error ? err.message : undefined);
      navigate("/proposals");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadPdf = async () => {
    if (!proposal) return;
    setDownloading(true);
    try {
      const safeTitle = proposal.title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
      await downloadFile(
        `/proposals/${proposal.id}/pdf`,
        { download: "true" },
        `${proposal.code}_${safeTitle}.pdf`
      );
      toast.success("PDF Downloaded", `Saved ${proposal.code} to your downloads.`);
    } catch (err) {
      toast.error("Could not generate PDF", err instanceof Error ? err.message : undefined);
    } finally {
      setDownloading(false);
    }
  };

  const openPdfInTab = () => {
    if (!proposal) return;
    const token = getStoredToken();
    const url = buildUrl(`/proposals/${proposal.id}/pdf`);
    // Fetch blob and open object URL
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load PDF");
        return res.blob();
      })
      .then((blob) => {
        const fileUrl = URL.createObjectURL(blob);
        window.open(fileUrl, "_blank");
      })
      .catch((err) => {
        toast.error("Could not open PDF viewer", err instanceof Error ? err.message : undefined);
      });
  };

  const shareWhatsApp = () => {
    if (!proposal) return;
    let phone = (proposal.phone ?? "").replace(/[^\d+]/g, "");
    if (!phone) {
      toast.error("Phone number missing", "No phone number recorded for this lead or client.");
      return;
    }
    if (phone.length === 10 && !phone.startsWith("+")) {
      phone = `91${phone}`;
    } else if (phone.startsWith("+")) {
      phone = phone.replace("+", "");
    }

    const appUrl = window.location.origin;
    const msg =
      `*STACKZYRO Proposal: ${proposal.code}*\n\n` +
      `Hello ${proposal.business_name ?? "Valued Client"},\n\n` +
      `Please find our commercial proposal for *${proposal.title}*.\n` +
      `• Total Quoted Amount: ${formatCurrency(proposal.amount, meta?.company.currency)}\n` +
      `• Proposal Reference: ${proposal.code}\n\n` +
      `You can review the interactive proposal specification and download the official A4 PDF document here:\n` +
      `${appUrl}/proposals/${proposal.id}/preview\n\n` +
      `Best regards,\n` +
      `STACKZYRO Digital Solutions`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const shareEmail = () => {
    if (!proposal) return;
    const email = proposal.email ?? "";
    const subject = `STACKZYRO Proposal: ${proposal.code} — ${proposal.title}`;
    const appUrl = window.location.origin;
    const body =
      `Dear ${proposal.contact_person || proposal.business_name || "Valued Client"},\n\n` +
      `Thank you for considering STACKZYRO. We are pleased to submit our formal commercial proposal for ${proposal.title}.\n\n` +
      `Proposal Summary:\n` +
      `- Proposal Code: ${proposal.code}\n` +
      `- Service: ${proposal.service_type || "Digital Solutions"}\n` +
      `- Total Quoted Amount: ${formatCurrency(proposal.amount, meta?.company.currency)}\n\n` +
      `You can view the full specification, deliverables, timeline, and download the official A4 PDF version here:\n` +
      `${appUrl}/proposals/${proposal.id}/preview\n\n` +
      `Please let us know if you have any questions or require any adjustments.\n\n` +
      `Best regards,\n` +
      `The STACKZYRO Team\n` +
      `Email: ${meta?.company.email || "stackzyro@gmail.com"}\n` +
      `Website: ${meta?.company.website || "www.stackzyro.com"}`;

    window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const approveProposal = async () => {
    if (!proposal) return;
    setApproving(true);
    try {
      const updated = await api.post<Proposal>(`/proposals/${proposal.id}/approve`);
      setProposal(updated);
      toast.success("Proposal approved", `${updated.code} is now marked as approved.`);
    } catch (err) {
      toast.error("Could not approve proposal", err instanceof Error ? err.message : undefined);
    } finally {
      setApproving(false);
    }
  };

  const markSent = async () => {
    if (!proposal) return;
    setSending(true);
    try {
      const updated = await api.post<Proposal>(`/proposals/${proposal.id}/send`);
      setProposal(updated);
      toast.success("Proposal marked as sent", updated.code);
    } catch (err) {
      toast.error("Could not update proposal", err instanceof Error ? err.message : undefined);
    } finally {
      setSending(false);
    }
  };

  const canApprove =
    user?.role === "admin" || (user?.permissions?.proposals ?? []).includes("approve");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f1eff8] text-xs text-ink-400">
        Preparing proposal…
      </div>
    );
  }

  if (!proposal) return null;

  const content = proposal.content as ProposalContent;

  return (
    <div className="min-h-screen bg-[#f1eff8] print-reset">
      <div className="no-print sticky top-0 z-20 border-b border-line bg-white shadow-xs">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/proposals")}
              aria-label="Back to proposals"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-ink-900">{proposal.title}</p>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-[10.5px] font-semibold tabular text-brand-700">{proposal.code}</span>
                <span className="text-ink-300">·</span>
                <span className="text-[10.5px] text-ink-600 truncate max-w-[180px]">{proposal.business_name}</span>
                <StatusBadge value={proposal.status} labels={PROPOSAL_STATUS_LABELS} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Share WhatsApp */}
            <Button
              variant="outline"
              size="sm"
              leftIcon={<MessageCircle className="h-3.5 w-3.5 text-emerald-600" />}
              onClick={shareWhatsApp}
              title="Share interactive proposal link via WhatsApp"
            >
              WhatsApp
            </Button>

            {/* Share Email */}
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Mail className="h-3.5 w-3.5 text-sky-600" />}
              onClick={shareEmail}
              title="Compose proposal email"
            >
              Email
            </Button>

            {/* Approve Button */}
            {canApprove && ["draft", "pending_approval"].includes(proposal.status) && (
              <Button
                variant="outline"
                size="sm"
                loading={approving}
                leftIcon={<CheckCircle className="h-3.5 w-3.5 text-blue-600" />}
                onClick={approveProposal}
              >
                Approve
              </Button>
            )}

            {/* Mark Sent */}
            {["draft", "pending_approval", "approved"].includes(proposal.status) && (
              <Button
                variant="secondary"
                size="sm"
                loading={sending}
                leftIcon={<Send className="h-3.5 w-3.5" />}
                onClick={markSent}
              >
                Mark sent
              </Button>
            )}

            {/* Edit */}
            <Link to={`/proposals/${proposal.id}/edit`}>
              <Button variant="outline" size="sm" leftIcon={<Pencil className="h-3.5 w-3.5" />}>
                Edit
              </Button>
            </Link>

            {/* View PDF */}
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ExternalLink className="h-3.5 w-3.5" />}
              onClick={openPdfInTab}
              title="Open ReportLab PDF stream in a new browser tab"
            >
              Open PDF
            </Button>

            {/* Download PDF (Server Generated) */}
            <Button
              size="sm"
              loading={downloading}
              leftIcon={<Download className="h-3.5 w-3.5" />}
              onClick={downloadPdf}
            >
              Download PDF
            </Button>

            {/* Print */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.print()}
              title="Print layout"
              aria-label="Print proposal"
            >
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[860px] px-3 py-6 sm:px-6">
        <div className="overflow-x-auto pb-4">
          <div className="mx-auto w-[794px]">
            <ProposalDocument
              proposal={proposal}
              company={
                meta?.company ?? {
                  name: "STACKZYRO",
                  tagline: "Turning Ideas Into Digital Solutions",
                  email: "stackzyro@gmail.com",
                  phone: "+91 98765 43210",
                  website: "www.stackzyro.com",
                  address: "Technology Park, Hyderabad, India",
                  logo: "",
                  currency: "INR",
                  proposal_footer: "STACKZYRO · Confidential Commercial Proposal",
                }
              }
              content={content}
            />
          </div>
        </div>
        <p className="no-print mt-2 text-center text-[10.5px] text-ink-400">
          This preview reflects the A4 corporate structure. Use <b>Download PDF</b> for the official ReportLab multi-page document.
        </p>
      </div>
    </div>
  );
}
