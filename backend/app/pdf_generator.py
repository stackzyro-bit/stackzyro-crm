import io
import json
from datetime import datetime
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# STACKZYRO Official Brand Color Palette
PRIMARY_PURPLE = colors.HexColor("#7838ED")
DEEP_PURPLE = colors.HexColor("#5425B8")
LIGHT_LAVENDER = colors.HexColor("#F5F0FF")
DEEP_INK = colors.HexColor("#111827")
MUTED_INK = colors.HexColor("#6B7280")
BORDER_COLOR = colors.HexColor("#E5E7EB")
BORDER_PURPLE = colors.HexColor("#DDD6FE")
ACCENT_BG = colors.HexColor("#F9FAFB")
SUCCESS_GREEN = colors.HexColor("#10B981")
WHITE = colors.white


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas that computes and prints running headers, footers
    and precise 'Page X of Y' page numbers.
    """

    def __init__(self, *args: Any, **kwargs: Any):
        super().__init__(*args, **kwargs)
        self._saved_page_states: list[dict[str, Any]] = []

    def showPage(self) -> None:
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int) -> None:
        self.saveState()
        page_width, page_height = A4

        # Page 1 is the Cover Page (no running header or footer)
        if self._pageNumber > 1:
            # Running Header
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(PRIMARY_PURPLE)
            self.drawString(1.5 * cm, page_height - 1.2 * cm, "STACKZYRO")
            self.setFont("Helvetica", 8)
            self.setFillColor(MUTED_INK)
            self.drawString(3.5 * cm, page_height - 1.2 * cm, "— Commercial Proposal & Technical Specification")

            self.drawRightString(
                page_width - 1.5 * cm,
                page_height - 1.2 * cm,
                getattr(self, "proposal_code", "STACKZYRO CRM"),
            )

            # Header thin line
            self.setStrokeColor(BORDER_COLOR)
            self.setLineWidth(0.5)
            self.line(1.5 * cm, page_height - 1.4 * cm, page_width - 1.5 * cm, page_height - 1.4 * cm)

            # Running Footer
            self.setStrokeColor(BORDER_COLOR)
            self.setLineWidth(0.5)
            self.line(1.5 * cm, 1.5 * cm, page_width - 1.5 * cm, 1.5 * cm)

            self.setFont("Helvetica", 8)
            self.setFillColor(MUTED_INK)
            self.drawString(
                1.5 * cm,
                1.1 * cm,
                "STACKZYRO · Turning Ideas Into Digital Solutions · Email: stackzyro@gmail.com",
            )

            # Page number
            page_text = f"Page {self._pageNumber} of {page_count}"
            self.drawRightString(page_width - 1.5 * cm, 1.1 * cm, page_text)

        self.restoreState()


def generate_proposal_pdf(proposal: Any, db_session: Any = None) -> bytes:
    """
    Generates a corporate, publication-ready multi-page A4 PDF proposal
    with STACKZYRO brand purple (#7838ED), deep purple (#5425B8), light lavender (#F5F0FF)
    and deep ink typography.
    """
    buffer = io.BytesIO()

    # Proposal content parsing
    raw_content = proposal.content
    if isinstance(raw_content, str):
        try:
            content = json.loads(raw_content)
        except Exception:
            content = {}
    elif isinstance(raw_content, dict):
        content = raw_content
    else:
        content = {}

    lead = getattr(proposal, "lead", None)
    business_name = getattr(lead, "business_name", None) or content.get("client_name") or "Valued Client"
    contact_person = getattr(lead, "contact_person", None) or content.get("contact_person") or "Business Representative"
    phone = getattr(lead, "phone", None) or content.get("client_phone") or "—"
    email = getattr(lead, "email", None) or content.get("client_email") or "—"
    location = getattr(lead, "location", None) or content.get("client_location") or "—"

    # Styles
    styles = getSampleStyleSheet()

    title_cover_style = ParagraphStyle(
        "CoverTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=30,
        textColor=DEEP_INK,
    )
    subtitle_cover_style = ParagraphStyle(
        "CoverSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=15,
        textColor=DEEP_PURPLE,
    )
    heading1_style = ParagraphStyle(
        "DocHeading1",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=DEEP_INK,
        spaceBefore=12,
        spaceAfter=5,
    )
    heading2_style = ParagraphStyle(
        "DocHeading2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=14,
        textColor=PRIMARY_PURPLE,
        spaceBefore=6,
        spaceAfter=3,
    )
    body_style = ParagraphStyle(
        "DocBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13.5,
        textColor=DEEP_INK,
        spaceAfter=5,
    )
    bullet_style = ParagraphStyle(
        "DocBullet",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12.5,
        textColor=DEEP_INK,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3,
    )
    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11.5,
        textColor=DEEP_INK,
    )
    table_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11.5,
        textColor=DEEP_INK,
    )
    table_cell_header = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11.5,
        textColor=WHITE,
    )

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.8 * cm,
        bottomMargin=1.8 * cm,
    )

    story: list[Any] = []

    # =========================================================================
    # 1. COVER PAGE
    # =========================================================================
    story.append(Spacer(1, 1.0 * cm))

    # Top Brand Header
    banner_data = [
        [
            Paragraph(
                "<font size=22 color='#7838ED'><b>STACKZYRO</b></font><br/>"
                "<font size=8.5 color='#6B7280'>TURNING IDEAS INTO DIGITAL SOLUTIONS</font>",
                styles["Normal"],
            ),
            Paragraph(
                f"<font size=8.5 color='#6B7280'><b>Proposal Ref:</b> <font color='#111827'>{proposal.code}</font><br/>"
                f"<b>Date:</b> {datetime.now().strftime('%d %B %Y')}<br/>"
                f"<b>Status:</b> <font color='#7838ED'><b>{proposal.status.upper()}</b></font></font>",
                styles["Normal"],
            ),
        ]
    ]
    banner_table = Table(banner_data, colWidths=[11.5 * cm, 6.5 * cm])
    banner_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(banner_table)

    story.append(Spacer(1, 0.3 * cm))
    story.append(HRFlowable(width="100%", thickness=2, color=PRIMARY_PURPLE, spaceAfter=20))

    # Proposal Title & Solution Target
    story.append(Paragraph("COMMERCIAL & TECHNICAL PROPOSAL", subtitle_cover_style))
    story.append(Spacer(1, 0.15 * cm))
    story.append(Paragraph(proposal.title, title_cover_style))
    story.append(Spacer(1, 0.3 * cm))

    service_name = proposal.service_type or "Enterprise Digital Solutions & Engineering"
    story.append(
        Paragraph(
            f"<font color='#6B7280'><b>Solution Category:</b></font> <font color='#7838ED'><b>{service_name}</b></font>",
            body_style,
        )
    )
    story.append(Spacer(1, 0.8 * cm))

    # Client & Agency Dual Metadata Card
    creator_name = proposal.created_by.name if proposal.created_by else "STACKZYRO Representative"
    meta_box_data = [
        [
            Paragraph("<b>PREPARED FOR (CLIENT):</b>", heading2_style),
            Paragraph("<b>PREPARED BY (AGENCY):</b>", heading2_style),
        ],
        [
            Paragraph(
                f"<b>{business_name}</b><br/>"
                f"Attn: {contact_person}<br/>"
                f"Email: {email}<br/>"
                f"Phone: {phone}<br/>"
                f"Location: {location}",
                body_style,
            ),
            Paragraph(
                "<b>STACKZYRO Digital Solutions</b><br/>"
                "Enterprise Web, Software & Growth Engineering<br/>"
                "Email: stackzyro@gmail.com<br/>"
                "Web: www.stackzyro.com<br/>"
                f"Lead Representative: {creator_name}",
                body_style,
            ),
        ],
    ]
    meta_table = Table(meta_box_data, colWidths=[9.0 * cm, 9.0 * cm])
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), LIGHT_LAVENDER),
                ("BOX", (0, 0), (-1, -1), 1, BORDER_PURPLE),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_PURPLE),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(meta_table)

    story.append(Spacer(1, 0.8 * cm))

    # Validity Callout
    valid_until = content.get("valid_until") or "30 days from issuance"
    validity_p = Paragraph(
        f"<b>CONFIDENTIALITY NOTICE & VALIDITY:</b> This document contains proprietary commercial quotation, "
        f"solution architectures, and specifications prepared exclusively for <b>{business_name}</b>. "
        f"The pricing, milestones, and deliverables detailed herein remain valid until <b>{valid_until}</b>.",
        ParagraphStyle("Notice", parent=body_style, fontSize=8, leading=11.5, textColor=MUTED_INK),
    )
    story.append(validity_p)

    story.append(PageBreak())

    # =========================================================================
    # 2. EXECUTIVE SUMMARY & COMPANY INTRODUCTION
    # =========================================================================
    story.append(Paragraph("1. Executive Summary & Company Introduction", heading1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceAfter=8))

    intro_text = (
        "<b>STACKZYRO</b> is a premier digital technology consultancy dedicated to <b>Turning Ideas Into Digital Solutions</b>. "
        "We build high-performance web applications, modern corporate digital portals, healthcare ERP solutions, "
        "and custom software platforms engineered for reliability, security, and measurable business growth."
    )
    story.append(Paragraph(intro_text, body_style))

    overview_text = content.get("overview") or (
        f"This proposal presents our comprehensive technical architecture, execution roadmap, deliverables, and commercial quotation "
        f"specifically architected for <b>{business_name}</b>."
    )
    story.append(Paragraph(overview_text, body_style))
    story.append(Spacer(1, 0.3 * cm))

    # =========================================================================
    # 3. UNDERSTANDING CLIENT REQUIREMENTS & OBJECTIVES
    # =========================================================================
    story.append(Paragraph("2. Understanding Client Requirements & Business Objectives", heading1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceAfter=8))

    requirements = content.get("requirements") or []
    if requirements:
        story.append(Paragraph("Based on discovery sessions, the following operational objectives and functional requirements have been established:", body_style))
        for req in requirements:
            story.append(Paragraph(f"• <b>Requirement:</b> {req}", bullet_style))
    else:
        default_reqs = [
            f"Establish a secure, modern, and credible digital platform for {business_name}.",
            "Streamline manual workflows, customer communication, and data handling.",
            "Implement high-converting, mobile-first responsive interfaces optimized for search visibility.",
        ]
        for req in default_reqs:
            story.append(Paragraph(f"• {req}", bullet_style))

    story.append(Spacer(1, 0.3 * cm))

    # =========================================================================
    # 4. PROPOSED SOLUTION & ARCHITECTURE
    # =========================================================================
    story.append(Paragraph("3. Proposed Solution & Architecture Approach", heading1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceAfter=8))

    solution_intro = (
        f"STACKZYRO proposes an end-to-end, tailor-made architecture built on modern industry standards. "
        f"The system is engineered to provide seamless user experience, rock-solid data integrity, and high operational scalability."
    )
    story.append(Paragraph(solution_intro, body_style))

    pillars_data = [
        [
            Paragraph("<b>Pillar 1: Modern Frontend Experience</b><br/><font size=7.5 color='#6B7280'>Responsive UI, ultra-fast load times, accessible design, and mobile-first experience.</font>", body_style),
            Paragraph("<b>Pillar 2: Robust & Scalable Backend</b><br/><font size=7.5 color='#6B7280'>Modular architecture, role-based access control, secure REST APIs, and automated logging.</font>", body_style),
        ],
        [
            Paragraph("<b>Pillar 3: Data Security & Integrity</b><br/><font size=7.5 color='#6B7280'>Enterprise database encryption, regular automated backups, and strict privacy compliance.</font>", body_style),
            Paragraph("<b>Pillar 4: Production Deployment & QA</b><br/><font size=7.5 color='#6B7280'>Multi-device QA testing, SSL certificates, cloud deployment, and comprehensive warranty.</font>", body_style),
        ],
    ]
    pillars_table = Table(pillars_data, colWidths=[9.0 * cm, 9.0 * cm])
    pillars_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), ACCENT_BG),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(pillars_table)

    story.append(Spacer(1, 0.3 * cm))

    # =========================================================================
    # 5. SCOPE OF WORK & KEY DELIVERABLES
    # =========================================================================
    story.append(Paragraph("4. Scope of Work & Key Deliverables", heading1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceAfter=8))

    scope_items = content.get("scope") or [
        "Requirement discovery and functional architecture sign-off",
        "Responsive UI/UX design with corporate brand alignment",
        "Front-end and back-end application development",
        "Quality assurance, performance testing and browser compatibility",
        "Deployment to production hosting and handover documentation",
    ]
    story.append(Paragraph("<b>Scope Breakdown:</b>", heading2_style))
    for s_item in scope_items:
        story.append(Paragraph(f"✓ <b>{s_item}</b>", bullet_style))

    deliverables = content.get("deliverables") or [
        "Fully deployed and tested digital solution",
        "Complete source code ownership or digital assets",
        "Administrator training and operational guide",
        "Dedicated warranty and bug-fix support",
    ]
    story.append(Spacer(1, 0.15 * cm))
    story.append(Paragraph("<b>Key Project Deliverables:</b>", heading2_style))
    for d_item in deliverables:
        story.append(Paragraph(f"★ <b>Deliverable:</b> {d_item}", bullet_style))

    # Technology Stack
    tech_stack = content.get("tech_stack") or []
    if tech_stack:
        story.append(Spacer(1, 0.15 * cm))
        story.append(Paragraph("<b>Recommended Technology Stack:</b>", heading2_style))
        tech_str = " · ".join([f"<b>{t}</b>" for t in tech_stack])
        story.append(Paragraph(f"<font color='#5425B8'>{tech_str}</font>", body_style))

    story.append(Spacer(1, 0.3 * cm))

    # =========================================================================
    # 6. PROJECT TIMELINE & DELIVERY MILESTONES
    # =========================================================================
    story.append(Paragraph("5. Project Execution Timeline & Delivery Milestones", heading1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceAfter=8))

    timeline = content.get("timeline") or [
        {"phase": "Phase 1: Discovery & Architecture", "duration": "1 week"},
        {"phase": "Phase 2: UI/UX Prototyping", "duration": "1 week"},
        {"phase": "Phase 3: Core Development & Implementation", "duration": "3 weeks"},
        {"phase": "Phase 4: QA, Testing & UAT Sign-off", "duration": "1 week"},
        {"phase": "Phase 5: Production Launch & Handover", "duration": "3 days"},
    ]

    timeline_data = [
        [
            Paragraph("<b>Project Phase / Milestone</b>", table_cell_header),
            Paragraph("<b>Estimated Duration</b>", table_cell_header),
        ]
    ]
    for row in timeline:
        phase_name = row.get("phase", "Phase")
        dur = row.get("duration", "TBD")
        timeline_data.append([Paragraph(phase_name, table_cell_bold), Paragraph(dur, table_cell_style)])

    t_table = Table(timeline_data, colWidths=[13.0 * cm, 5.0 * cm])
    t_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_PURPLE),
                ("ALIGN", (1, 0), (1, -1), "CENTER"),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, ACCENT_BG]),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(t_table)

    story.append(Spacer(1, 0.3 * cm))

    # =========================================================================
    # 7. PRICING BREAKDOWN & INVESTMENT QUOTATION
    # =========================================================================
    story.append(KeepTogether([
        Paragraph("6. Commercial Proposal & Investment Quotation", heading1_style),
        HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceAfter=8),
    ]))

    pricing_rows = content.get("pricing") or [
        {
            "item": proposal.title,
            "description": f"Full execution and delivery for {business_name}",
            "qty": 1,
            "rate": proposal.amount,
            "amount": proposal.amount,
        }
    ]

    pricing_table_data = [
        [
            Paragraph("<b>Item / Service Specification</b>", table_cell_header),
            Paragraph("<b>Qty</b>", table_cell_header),
            Paragraph("<b>Unit Rate (₹)</b>", table_cell_header),
            Paragraph("<b>Total (₹)</b>", table_cell_header),
        ]
    ]

    for p_row in pricing_rows:
        item_title = p_row.get("item", "Service")
        desc = p_row.get("description", "")
        item_html = f"<b>{item_title}</b>"
        if desc:
            item_html += f"<br/><font size=7.5 color='#6B7280'>{desc}</font>"

        qty = p_row.get("qty", 1)
        rate = float(p_row.get("rate", 0))
        amt = float(p_row.get("amount", rate * qty))

        pricing_table_data.append([
            Paragraph(item_html, table_cell_style),
            Paragraph(str(qty), table_cell_style),
            Paragraph(f"₹{rate:,.2f}", table_cell_style),
            Paragraph(f"₹{amt:,.2f}", table_cell_bold),
        ])

    subtotal = float(content.get("subtotal") or proposal.amount or 0)
    discount = float(content.get("discount") or 0)
    tax_rate = float(content.get("tax_rate") or 0)
    tax_amt = (subtotal - discount) * (tax_rate / 100.0) if tax_rate > 0 else 0
    total = float(content.get("total") or (subtotal - discount + tax_amt))

    # Subtotal row
    pricing_table_data.append([
        Paragraph("<b>Subtotal</b>", table_cell_bold),
        Paragraph("", table_cell_style),
        Paragraph("", table_cell_style),
        Paragraph(f"<b>₹{subtotal:,.2f}</b>", table_cell_bold),
    ])
    if discount > 0:
        pricing_table_data.append([
            Paragraph("<b>Special Discount</b>", table_cell_bold),
            Paragraph("", table_cell_style),
            Paragraph("", table_cell_style),
            Paragraph(f"<font color='#10B981'>-₹{discount:,.2f}</font>", table_cell_bold),
        ])
    if tax_rate > 0:
        pricing_table_data.append([
            Paragraph(f"<b>GST / Tax ({tax_rate}%)</b>", table_cell_bold),
            Paragraph("", table_cell_style),
            Paragraph("", table_cell_style),
            Paragraph(f"₹{tax_amt:,.2f}", table_cell_bold),
        ])

    # Final Total highlight row
    pricing_table_data.append([
        Paragraph("<font size=9.5 color='#5425B8'><b>FINAL INVESTMENT TOTAL</b></font>", styles["Normal"]),
        Paragraph("", table_cell_style),
        Paragraph("", table_cell_style),
        Paragraph(f"<font size=10.5 color='#5425B8'><b>₹{total:,.2f}</b></font>", styles["Normal"]),
    ])

    price_table = Table(pricing_table_data, colWidths=[9.5 * cm, 2.0 * cm, 3.2 * cm, 3.3 * cm])
    price_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_PURPLE),
                ("ALIGN", (1, 0), (1, -1), "CENTER"),
                ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -2), 0.5, BORDER_COLOR),
                ("ROWBACKGROUNDS", (0, 1), (-1, -5 if discount > 0 or tax_rate > 0 else -3), [WHITE, ACCENT_BG]),
                ("LINEABOVE", (0, -1), (-1, -1), 1.5, PRIMARY_PURPLE),
                ("BACKGROUND", (0, -1), (-1, -1), LIGHT_LAVENDER),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(price_table)

    story.append(Spacer(1, 0.3 * cm))

    # =========================================================================
    # 8. PAYMENT TERMS & WARRANTY SUPPORT
    # =========================================================================
    story.append(KeepTogether([
        Paragraph("7. Payment Terms, Warranty & Support", heading1_style),
        HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceAfter=8),
        Paragraph(f"<b>Payment Schedule:</b> {content.get('payment_terms') or '50% advance to initiate project, 30% upon milestone sign-off, 20% prior to final production launch.'}", body_style),
    ]))

    support_terms = content.get("support_terms") or "Includes 60 days dedicated post-launch bug fixing, SLA support, and maintenance warranty."
    story.append(Paragraph(f"<b>Warranty & Maintenance:</b> {support_terms}", body_style))

    add_costs = content.get("additional_costs") or "Server hosting, domain names, third-party SMS/WhatsApp APIs and external premium licenses are billed at actuals."
    story.append(Paragraph(f"<b>Additional Cost Notes:</b> <font color='#6B7280'>{add_costs}</font>", body_style))

    story.append(Spacer(1, 0.3 * cm))

    # =========================================================================
    # 9. TERMS & CONDITIONS
    # =========================================================================
    terms = content.get("terms") or [
        "The project timeline begins upon receipt of the initial advance payment and required client assets.",
        "Included revisions cover the agreed scope; additions or substantial modifications are quoted separately.",
        "Client designates a primary point of contact for timely milestone review and feedback.",
        "Full source code ownership and digital copyrights are transferred following final settlement.",
    ]
    story.append(KeepTogether([
        Paragraph("8. Terms & Conditions", heading1_style),
        HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceAfter=8),
        *[Paragraph(f"{idx + 1}. {term}", bullet_style) for idx, term in enumerate(terms)],
    ]))

    story.append(Spacer(1, 0.4 * cm))

    # =========================================================================
    # 10. CLIENT ACCEPTANCE SIGN-OFF & AUTHORIZATION
    # =========================================================================
    story.append(KeepTogether([
        Paragraph("9. Authorization & Mutual Acceptance", heading1_style),
        HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceAfter=8),
        Paragraph(
            "To confirm and authorize the project as outlined in this proposal, please sign below and return a copy to STACKZYRO. "
            "We look forward to a successful engagement turning your vision into digital excellence.",
            body_style,
        ),
        Spacer(1, 0.25 * cm),
    ]))

    # Sign-off Dual Box Table
    sign_table_data = [
        [
            Paragraph("<b>ACCEPTED AND AUTHORIZED BY CLIENT:</b>", heading2_style),
            Paragraph("<b>AUTHORIZED FOR STACKZYRO:</b>", heading2_style),
        ],
        [
            Paragraph(
                f"<b>Authorized Signature:</b> _______________________<br/><br/>"
                f"<b>Name:</b> {contact_person}<br/><br/>"
                f"<b>Title:</b> ___________________________________<br/><br/>"
                f"<b>Company:</b> {business_name}<br/><br/>"
                f"<b>Date:</b> ___________________________________",
                body_style,
            ),
            Paragraph(
                "<b>Authorized Signature:</b> _______________________<br/><br/>"
                f"<b>Name:</b> {creator_name}<br/><br/>"
                "<b>Title:</b> Solutions Director / Technical Lead<br/><br/>"
                "<b>Company:</b> STACKZYRO Digital Solutions<br/><br/>"
                f"<b>Date:</b> {datetime.now().strftime('%d %B %Y')}",
                body_style,
            ),
        ],
    ]
    sign_table = Table(sign_table_data, colWidths=[9.0 * cm, 9.0 * cm])
    sign_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), LIGHT_LAVENDER),
                ("BOX", (0, 0), (-1, -1), 1, BORDER_PURPLE),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_PURPLE),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(sign_table)

    # Attach proposal code to canvas for headers
    def on_first_page(canvas_obj: canvas.Canvas, _doc: Any) -> None:
        setattr(canvas_obj, "proposal_code", proposal.code)

    doc.build(story, canvasmaker=NumberedCanvas, onFirstPage=on_first_page)

    buffer.seek(0)
    return buffer.getvalue()
