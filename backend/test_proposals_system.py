import sys
import traceback
from app.database import SessionLocal
from app.models import User, Lead, Client, Proposal
from app.routers.proposals import (
    list_proposals,
    get_proposal,
    create_proposal,
    get_proposal_pdf,
    approve_proposal,
)
from app.schemas import ProposalPayload

def run_proposal_tests():
    print("=" * 65)
    print("      PROPOSALS & PDF GENERATOR - AUTOMATED TEST SUITE")
    print("=" * 65)

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == "admin@stackzyro.com").first()
        staff = db.query(User).filter(User.email == "ayesha@stackzyro.com").first()
        assert admin is not None
        assert staff is not None

        # 1. List proposals
        print("\n[TEST 1] Listing Proposals")
        res = list_proposals(page=1, page_size=10, user=admin, db=db)
        items = res["items"]
        assert len(items) > 0
        prop_id = items[0]["id"]
        prop_code = items[0]["code"]
        print(f"  [PASS] Found {res['total']} proposals. Testing with #{prop_id} ({prop_code}).")

        # 2. PDF Generation
        print("\n[TEST 2] Proposal PDF Generation & Response Headers")
        pdf_res = get_proposal_pdf(proposal_id=prop_id, download=False, user=admin, db=db)
        assert pdf_res.media_type == "application/pdf"
        assert pdf_res.body.startswith(b"%PDF"), "Must start with %PDF header"
        assert len(pdf_res.body) > 3000, "PDF too small"
        print(f"  [PASS] PDF generated inline: {len(pdf_res.body)} bytes. Header: {pdf_res.headers['Content-Disposition']}")

        # 3. PDF Attachment Download
        print("\n[TEST 3] Proposal PDF Download Flag")
        pdf_dl = get_proposal_pdf(proposal_id=prop_id, download=True, user=admin, db=db)
        assert "attachment;" in pdf_dl.headers["Content-Disposition"]
        print(f"  [PASS] Attachment header verified: {pdf_dl.headers['Content-Disposition']}")

        # 4. Proposal Approval
        print("\n[TEST 4] Proposal Approval Flow")
        appr = approve_proposal(proposal_id=prop_id, user=admin, db=db)
        assert appr["status"] == "approved"
        print(f"  [PASS] Proposal {prop_code} successfully marked approved.")

        # 5. Create Proposal for Client Directly
        print("\n[TEST 5] Create Proposal for Client Directly (No duplicate entry)")
        client = db.query(Client).first()
        assert client is not None
        new_payload = ProposalPayload(
            client_id=client.id,
            title=f"Custom Enterprise Solution for {client.business_name}",
            service_type="Custom Software Development",
            template_key="custom-software",
            amount=95000.0,
            status="draft"
        )
        created = create_proposal(payload=new_payload, user=admin, db=db)
        new_id = created["id"]
        new_code = created["code"]
        assert created["client_id"] == client.id
        print(f"  [PASS] Created proposal {new_code} for Client #{client.id} ({client.business_name}).")

        # 6. Generate PDF for the newly created proposal
        print("\n[TEST 6] PDF Generation for Newly Created Proposal")
        new_pdf_res = get_proposal_pdf(proposal_id=new_id, download=False, user=admin, db=db)
        assert new_pdf_res.body.startswith(b"%PDF")
        assert len(new_pdf_res.body) > 3000
        print(f"  [PASS] New proposal PDF generated: {len(new_pdf_res.body)} bytes.")

        print("\n" + "=" * 65)
        print("  ALL PROPOSAL & PDF TESTS PASSED PERFECTLY! [OK]")
        print("=" * 65)
        return True

    except Exception as e:
        print(f"\n  [FAIL] TEST FAILED: {e}")
        traceback.print_exc()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = run_proposal_tests()
    sys.exit(0 if success else 1)
