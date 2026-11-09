import json
from decimal import Decimal
from app.database import SessionLocal
from app.models import Proposal, Lead, User, ProposalTemplateModel
from app.pdf_generator import generate_proposal_pdf
from app.constants import PROPOSAL_TEMPLATES
from app.routers.proposals import (
    list_templates,
    get_template,
    create_template,
    update_template,
    duplicate_template,
    delete_template,
    create_proposal,
    duplicate_proposal,
    get_proposal_pdf,
)
from app.schemas import ProposalPayload, ProposalTemplatePayload, ProposalTemplateUpdate
from app.migrations import apply_migrations

def main():
    apply_migrations()
    db = SessionLocal()
    try:
        lead = db.query(Lead).first()
        admin = db.query(User).filter(User.role == "admin").first()
        assert lead is not None, "Lead required for testing"
        assert admin is not None, "Admin user required"

        # Check hospital-erp in PROPOSAL_TEMPLATES
        erp_tmpl = next((t for t in PROPOSAL_TEMPLATES if t["key"] == "hospital-erp"), None)
        assert erp_tmpl is not None, "hospital-erp template missing from PROPOSAL_TEMPLATES"
        print("[PASS] hospital-erp template exists in constants with title:", erp_tmpl["title"])

        # 1. Test list_templates
        templates = list_templates(db=db, user=admin)
        assert len(templates) >= 9, f"Expected >=9 templates, got {len(templates)}"
        keys = [t["key"] for t in templates]
        assert "hospital-erp" in keys, "hospital-erp not in list_templates"
        print(f"[PASS] list_templates returned {len(templates)} templates including hospital-erp")

        # 2. Test get_template
        retrieved_erp = get_template(key="hospital-erp", db=db, user=admin)
        assert retrieved_erp["key"] == "hospital-erp"
        assert "OPD" in retrieved_erp["overview"]
        print("[PASS] get_template returned hospital-erp template successfully")

        # 3. Test create_template (custom template)
        custom_key = "custom-test-hospital-clinic"
        existing = db.query(ProposalTemplateModel).filter(ProposalTemplateModel.key == custom_key).first()
        if existing:
            db.delete(existing)
            db.commit()

        custom_payload = ProposalTemplatePayload(
            key=custom_key,
            name="Speciality Clinic ERP",
            service="Hospital Management ERP",
            title="Speciality Clinic & Polyclinic Management Suite",
            overview="Tailored healthcare management system for {business}.",
            scope=["Patient queuing", "Prescription management", "Billing & claims"],
            deliverables=["Web platform", "Doctor mobile app", "90 days warranty"],
            timeline=[{"phase": "Sprint 1", "duration": "2 weeks"}],
            tech_stack=["React", "FastAPI", "PostgreSQL"],
            pricing=[{"item": "Clinic Suite Core", "rate": 180000, "qty": 1, "amount": 180000}],
            payment_terms="50% advance, 50% launch",
            additional_costs="SMS credits billed at actuals",
            terms=["HIPAA data privacy terms apply."],
            support_terms="90 days warranty",
            is_default=False
        )
        created_tmpl = create_template(payload=custom_payload, user=admin, db=db)
        assert created_tmpl["key"] == custom_key
        print("[PASS] create_template created custom template successfully")

        # 4. Test duplicate_template
        dup_tmpl = duplicate_template(key=custom_key, user=admin, db=db)
        assert "copy" in dup_tmpl["key"]
        print(f"[PASS] duplicate_template created copy: {dup_tmpl['key']}")

        # 5. Test update_template
        updated_tmpl = update_template(
            key=dup_tmpl["key"],
            payload=ProposalTemplateUpdate(title="Updated Speciality Clinic Suite"),
            user=admin,
            db=db
        )
        assert updated_tmpl["title"] == "Updated Speciality Clinic Suite"
        print("[PASS] update_template modified template title successfully")

        # 6. Test delete_template
        del_res = delete_template(key=dup_tmpl["key"], user=admin, db=db)
        assert del_res["message"] == "Template deleted successfully."
        print("[PASS] delete_template deleted duplicated template successfully")

        # 7. Test create_proposal with hospital-erp
        prop_payload = ProposalPayload(
            lead_id=lead.id,
            template_key="hospital-erp",
            title="Healthcare ERP - City Care Hospital",
            service_type="Hospital Management ERP",
            amount=380000.0,
            status="draft"
        )
        new_prop = create_proposal(payload=prop_payload, user=admin, db=db)
        assert new_prop["code"]
        assert new_prop["template_key"] == "hospital-erp"
        print(f"[PASS] create_proposal created proposal {new_prop['code']} using hospital-erp")

        # 8. Test duplicate_proposal
        dup_prop = duplicate_proposal(proposal_id=new_prop["id"], user=admin, db=db)
        assert dup_prop["code"] != new_prop["code"]
        assert "(Copy)" in dup_prop["title"]
        print(f"[PASS] duplicate_proposal created copy {dup_prop['code']}")

        # 9. Test get_proposal_pdf
        pdf_response = get_proposal_pdf(proposal_id=new_prop["id"], download=None, user=admin, db=db)
        pdf_bytes = pdf_response.body
        assert len(pdf_bytes) > 5000, f"PDF too small: {len(pdf_bytes)}"
        assert pdf_bytes.startswith(b"%PDF"), "Generated bytes not valid PDF"
        print(f"[PASS] get_proposal_pdf generated {len(pdf_bytes)} bytes of valid PDF")

        print("\nALL BACKEND PROPOSAL REDESIGN TESTS PASSED SUCCESSFULLY!")

    finally:
        db.close()

if __name__ == "__main__":
    main()
