import {
  CheckCircle2,
  Cpu,
  Globe,
  Layers,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { formatCurrency, formatDate } from "../../lib/format";
import type { Meta, Proposal, ProposalContent } from "../../lib/types";

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="mb-3.5 flex items-center gap-2.5 border-b border-[#E5E7EB] pb-2">
      <span className="flex h-5 w-5 items-center justify-center rounded bg-[#7838ED] text-[10px] font-bold text-white">
        {number}
      </span>
      <h2 className="text-[12pt] font-bold tracking-tight text-[#111827]">{title}</h2>
    </div>
  );
}

export function ProposalDocument({
  proposal,
  company,
  content,
}: {
  proposal: Proposal;
  company?: Meta["company"];
  content: ProposalContent;
}) {
  const currency = company?.currency || "INR";
  const subtotal = Number(content.subtotal) || 0;
  const discount = Number(content.discount) || 0;
  const taxRate = Number(content.tax_rate) || 0;
  const taxable = Math.max(subtotal - discount, 0);
  const tax = (taxable * taxRate) / 100;
  const total = taxable + tax;

  const requirements = (content.requirements ?? []).filter((item) => item && item.trim());
  const scope = (content.scope ?? []).filter((item) => item && item.trim());
  const deliverables = (content.deliverables ?? []).filter((item) => item && item.trim());
  const techStack = (content.tech_stack ?? []).filter((item) => item && item.trim());
  const timeline = (content.timeline ?? []).filter((item) => item.phase?.trim());
  const terms = (content.terms ?? []).filter((item) => item && item.trim());
  const pricing = (content.pricing ?? []).filter((row) => row.item?.trim());

  return (
    <article className="proposal-sheet relative flex min-h-[1100px] flex-col rounded-xl bg-white p-8 text-[#111827] shadow-lg print:m-0 print:min-h-0 print:p-0 print:shadow-none">
      {/* 1. TOP HEADER BANNER */}
      <header className="flex items-start justify-between gap-6 border-b-2 border-[#7838ED] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#7838ED] text-white shadow-sm">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[18pt] font-black tracking-wider text-[#7838ED]">
                STACKZYRO
              </p>
              <p className="text-[8pt] font-semibold uppercase tracking-[0.15em] text-[#6B7280]">
                Turning Ideas Into Digital Solutions
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#DDD6FE] bg-[#F5F0FF] px-4 py-2.5 text-right text-[8.5pt] leading-snug">
          <p className="font-semibold text-[#5425B8]">
            <span className="text-[#6B7280]">Ref:</span> {proposal.code}
          </p>
          <p className="text-[#6B7280]">
            <span className="font-medium text-[#111827]">Date:</span> {formatDate(proposal.created_at)}
          </p>
          {content.valid_until && (
            <p className="text-[#6B7280]">
              <span className="font-medium text-[#111827]">Valid until:</span> {formatDate(content.valid_until)}
            </p>
          )}
          <div className="mt-1 inline-block rounded bg-[#7838ED] px-2 py-0.5 text-[7.5pt] font-bold uppercase tracking-wider text-white">
            {proposal.status}
          </div>
        </div>
      </header>

      {/* 2. TITLE & SERVICE BOX */}
      <div className="mt-6">
        <p className="text-[8.5pt] font-bold uppercase tracking-widest text-[#5425B8]">
          Commercial & Technical Proposal
        </p>
        <h1 className="mt-1 text-[20pt] font-extrabold leading-tight text-[#111827]">
          {proposal.title}
        </h1>
        {proposal.service_type && (
          <p className="mt-1 text-[9.5pt] text-[#6B7280]">
            Target Solution:{" "}
            <span className="font-semibold text-[#7838ED]">{proposal.service_type}</span>
          </p>
        )}
      </div>

      {/* 3. DUAL METADATA CARD (CLIENT & AGENCY) */}
      <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-[#DDD6FE] bg-[#F5F0FF] p-4 text-[9pt]">
        <div>
          <p className="text-[8pt] font-bold uppercase tracking-wider text-[#5425B8]">
            Prepared For (Client)
          </p>
          <p className="mt-1 text-[10.5pt] font-bold text-[#111827]">
            {proposal.business_name || "Valued Client"}
          </p>
          <div className="mt-1.5 space-y-0.5 text-[8.5pt] text-[#6B7280]">
            {proposal.contact_person && (
              <p className="text-[#111827] font-medium">Attn: {proposal.contact_person}</p>
            )}
            {content.client_email && (
              <p className="flex items-center gap-1.5">
                <Mail className="h-3 w-3 text-[#7838ED]" /> {content.client_email}
              </p>
            )}
            {content.client_phone && (
              <p className="flex items-center gap-1.5">
                <Phone className="h-3 w-3 text-[#7838ED]" /> {content.client_phone}
              </p>
            )}
            {content.client_location && (
              <p className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-[#7838ED]" /> {content.client_location}
              </p>
            )}
          </div>
        </div>

        <div>
          <p className="text-[8pt] font-bold uppercase tracking-wider text-[#5425B8]">
            Prepared By (Agency)
          </p>
          <p className="mt-1 text-[10.5pt] font-bold text-[#111827]">
            STACKZYRO Digital Solutions
          </p>
          <div className="mt-1.5 space-y-0.5 text-[8.5pt] text-[#6B7280]">
            <p className="text-[#111827] font-medium">
              Lead: {proposal.created_by?.name || "STACKZYRO Solutions Specialist"}
            </p>
            <p className="flex items-center gap-1.5">
              <Mail className="h-3 w-3 text-[#7838ED]" /> stackzyro@gmail.com
            </p>
            <p className="flex items-center gap-1.5">
              <Globe className="h-3 w-3 text-[#7838ED]" /> www.stackzyro.com
            </p>
            <p>Enterprise Web, Software & Growth Engineering</p>
          </div>
        </div>
      </div>

      {/* 4. EXECUTIVE SUMMARY */}
      {content.overview && (
        <section className="mt-7 break-inside-avoid">
          <SectionHeader number="01" title="Executive Summary & Project Overview" />
          <p className="whitespace-pre-line text-[9pt] leading-relaxed text-[#374151]">
            {content.overview}
          </p>
        </section>
      )}

      {/* 5. CLIENT REQUIREMENTS */}
      {requirements.length > 0 && (
        <section className="mt-6 break-inside-avoid">
          <SectionHeader number="02" title="Understanding Client Requirements & Objectives" />
          <ul className="grid grid-cols-1 gap-2 text-[9pt] text-[#374151] sm:grid-cols-2">
            {requirements.map((req, idx) => (
              <li key={idx} className="flex items-start gap-2 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-2.5">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7838ED]" />
                <span className="leading-snug">{req}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 6. PROPOSED ARCHITECTURE PILLARS */}
      <section className="mt-6 break-inside-avoid">
        <SectionHeader number="03" title="Proposed Solution Architecture & Engineering Approach" />
        <div className="grid grid-cols-2 gap-3 text-[8.5pt]">
          <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3">
            <p className="font-bold text-[#7838ED]">1. Modern Responsive UI/UX</p>
            <p className="mt-1 text-[#6B7280]">
              Mobile-first responsive interface, fast loading times, accessible components and sleek brand consistency.
            </p>
          </div>
          <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3">
            <p className="font-bold text-[#7838ED]">2. Robust Modular Backend</p>
            <p className="mt-1 text-[#6B7280]">
              Secure RESTful APIs, role-based access control, automated audit logging and clean code standards.
            </p>
          </div>
          <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3">
            <p className="font-bold text-[#7838ED]">3. Data Security & Encryption</p>
            <p className="mt-1 text-[#6B7280]">
              Enterprise-grade database protection, automated backups, and adherence to industry privacy protocols.
            </p>
          </div>
          <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3">
            <p className="font-bold text-[#7838ED]">4. QA, Handover & SLA Support</p>
            <p className="mt-1 text-[#6B7280]">
              Cross-browser testing, production cloud deployment, staff training guides, and dedicated warranty support.
            </p>
          </div>
        </div>
      </section>

      {/* 7. SCOPE & DELIVERABLES */}
      {(scope.length > 0 || deliverables.length > 0) && (
        <section className="mt-6 break-inside-avoid">
          <SectionHeader number="04" title="Scope of Work & Key Deliverables" />
          {scope.length > 0 && (
            <div>
              <p className="mb-2 text-[8.5pt] font-bold uppercase tracking-wider text-[#5425B8]">
                Scope Breakdown:
              </p>
              <div className="grid grid-cols-1 gap-1.5 text-[8.5pt] text-[#374151] sm:grid-cols-2">
                {scope.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#10B981]" />
                    <span className="leading-snug">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {deliverables.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[8.5pt] font-bold uppercase tracking-wider text-[#5425B8]">
                Key Deliverables:
              </p>
              <div className="grid grid-cols-2 gap-2 text-[8.5pt]">
                {deliverables.map((item, idx) => (
                  <div key={idx} className="rounded-md border border-[#DDD6FE] bg-[#F5F0FF] px-2.5 py-1.5 font-medium text-[#5425B8]">
                    ★ {item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 8. TECHNOLOGY STACK */}
      {techStack.length > 0 && (
        <section className="mt-6 break-inside-avoid">
          <SectionHeader number="05" title="Recommended Technology Stack" />
          <div className="flex flex-wrap gap-2 text-[8.5pt]">
            {techStack.map((tech, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDD6FE] bg-[#F5F0FF] px-3 py-1 font-semibold text-[#5425B8]"
              >
                <Cpu className="h-3 w-3 text-[#7838ED]" />
                {tech}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 9. TIMELINE */}
      {timeline.length > 0 && (
        <section className="mt-6 break-inside-avoid">
          <SectionHeader number="06" title="Project Execution Timeline & Milestones" />
          <table className="w-full border-collapse overflow-hidden rounded-lg text-[8.5pt]">
            <thead>
              <tr className="bg-[#7838ED] text-left text-white">
                <th className="px-3.5 py-2 font-bold">Milestone / Execution Phase</th>
                <th className="w-[30%] px-3.5 py-2 text-center font-bold">Estimated Duration</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((row, idx) => (
                <tr
                  key={idx}
                  className={idx % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}
                >
                  <td className="border border-[#E5E7EB] px-3.5 py-2 font-medium text-[#111827]">
                    {row.phase}
                  </td>
                  <td className="border border-[#E5E7EB] px-3.5 py-2 text-center text-[#6B7280]">
                    {row.duration || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 10. PRICING & COMMERCIAL PROPOSAL */}
      <section className="mt-6 break-inside-avoid">
        <SectionHeader number="07" title="Commercial Proposal & Investment Quotation" />
        <table className="w-full border-collapse overflow-hidden rounded-lg text-[8.5pt]">
          <thead>
            <tr className="bg-[#7838ED] text-left text-white">
              <th className="px-3.5 py-2 font-bold">Item / Service Specification</th>
              <th className="w-[10%] px-3 py-2 text-center font-bold">Qty</th>
              <th className="w-[20%] px-3 py-2 text-right font-bold">Rate</th>
              <th className="w-[22%] px-3.5 py-2 text-right font-bold">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {pricing.map((row, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}>
                <td className="border border-[#E5E7EB] px-3.5 py-2">
                  <p className="font-bold text-[#111827]">{row.item}</p>
                  {row.description && (
                    <p className="text-[7.5pt] text-[#6B7280]">{row.description}</p>
                  )}
                </td>
                <td className="border border-[#E5E7EB] px-3 py-2 text-center text-[#6B7280]">
                  {row.qty}
                </td>
                <td className="border border-[#E5E7EB] px-3 py-2 text-right text-[#6B7280]">
                  {formatCurrency(row.rate, currency)}
                </td>
                <td className="border border-[#E5E7EB] px-3.5 py-2 text-right font-semibold text-[#111827]">
                  {formatCurrency(row.amount, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pricing Totals Box */}
        <div className="mt-2.5 ml-auto w-[320px] rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 text-[9pt]">
          <div className="flex justify-between py-0.5 text-[#6B7280]">
            <span>Subtotal</span>
            <span className="font-medium text-[#111827]">{formatCurrency(subtotal, currency)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between py-0.5 text-[#10B981]">
              <span>Special Discount</span>
              <span className="font-medium">− {formatCurrency(discount, currency)}</span>
            </div>
          )}
          {taxRate > 0 && (
            <div className="flex justify-between py-0.5 text-[#6B7280]">
              <span>GST / Tax ({taxRate}%)</span>
              <span className="font-medium text-[#111827]">{formatCurrency(tax, currency)}</span>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between border-t border-[#DDD6FE] pt-2 text-[11pt] font-black text-[#5425B8]">
            <span>Final Investment Total</span>
            <span>{formatCurrency(total, currency)}</span>
          </div>
        </div>
      </section>

      {/* 11. PAYMENT TERMS & WARRANTY */}
      <section className="mt-6 break-inside-avoid">
        <SectionHeader number="08" title="Payment Terms, Warranty & SLA Support" />
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3.5 text-[8.5pt]">
          <div>
            <p className="font-bold text-[#5425B8]">Payment Terms:</p>
            <p className="mt-1 text-[#374151]">
              {content.payment_terms || "50% advance to initiate project, 30% upon milestone review, 20% prior to final production launch."}
            </p>
          </div>
          <div>
            <p className="font-bold text-[#5425B8]">Warranty & Support:</p>
            <p className="mt-1 text-[#374151]">
              {content.support_terms || "Includes 60 days dedicated post-launch bug fixing, SLA support, and maintenance warranty."}
            </p>
          </div>
          {content.additional_costs && (
            <div className="col-span-2 border-t border-[#E5E7EB] pt-2 text-[#6B7280]">
              <span className="font-semibold text-[#111827]">Additional Cost Notes: </span>
              {content.additional_costs}
            </div>
          )}
        </div>
      </section>

      {/* 12. TERMS & CONDITIONS */}
      {terms.length > 0 && (
        <section className="mt-6 break-inside-avoid">
          <SectionHeader number="09" title="Terms & Conditions" />
          <ol className="space-y-1.5 text-[8.5pt] text-[#4B5563]">
            {terms.map((term, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="font-bold text-[#7838ED]">{idx + 1}.</span>
                <span className="leading-relaxed">{term}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 13. AUTHORIZATION & ACCEPTANCE SIGN-OFF */}
      <section className="mt-7 break-inside-avoid">
        <SectionHeader number="10" title="Authorization & Mutual Acceptance" />
        <p className="text-[8.5pt] leading-relaxed text-[#4B5563]">
          To authorize this proposal and confirm project kickoff, please sign below and return a signed copy to{" "}
          <span className="font-semibold text-[#7838ED]">stackzyro@gmail.com</span>.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-6 rounded-xl border border-[#DDD6FE] bg-[#F5F0FF] p-4 text-[8.5pt]">
          <div className="space-y-3">
            <p className="font-bold uppercase tracking-wider text-[#5425B8]">
              Accepted By Client:
            </p>
            <div className="h-10 border-b border-[#DDD6FE]" />
            <p className="font-semibold text-[#111827]">
              {proposal.contact_person || "Authorized Signatory"}
            </p>
            <p className="text-[#6B7280]">For {proposal.business_name || "Client Organisation"}</p>
            <p className="text-[#6B7280]">Date: ________________________</p>
          </div>

          <div className="space-y-3">
            <p className="font-bold uppercase tracking-wider text-[#5425B8]">
              Authorized For STACKZYRO:
            </p>
            <div className="h-10 border-b border-[#DDD6FE]" />
            <p className="font-semibold text-[#111827]">
              {proposal.created_by?.name || "STACKZYRO Solutions Director"}
            </p>
            <p className="text-[#6B7280]">For STACKZYRO Digital Solutions</p>
            <p className="text-[#6B7280]">Date: {formatDate(new Date().toISOString())}</p>
          </div>
        </div>
      </section>

      {/* 14. FOOTER */}
      <footer className="mt-auto border-t border-[#E5E7EB] pt-4 text-center text-[8pt] text-[#6B7280]">
        <p>
          STACKZYRO · Turning Ideas Into Digital Solutions · Email: stackzyro@gmail.com · Web: www.stackzyro.com
        </p>
        <p className="mt-0.5 text-[7.5pt] text-[#9CA3AF]">
          Document Ref: {proposal.code} · Commercial In Confidence
        </p>
      </footer>
    </article>
  );
}
