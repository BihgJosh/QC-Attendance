from pathlib import Path
import hashlib
import json
import os
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts" / "notifications"
OUTPUT.mkdir(parents=True, exist_ok=True)
BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:3000")


def admin_password() -> str:
    for filename in (".env.local", ".env"):
        path = ROOT / filename
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.startswith("ADMIN_PASSWORD="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("ADMIN_PASSWORD is unavailable")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    console_errors = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)

    session = hashlib.sha256(f"qcu-attendance-admin-session:{admin_password()}".encode()).hexdigest()
    page.context.add_cookies([{"name": "admin_session", "value": session, "url": BASE_URL, "sameSite": "Strict"}])
    page.route("**/api/member/profile", lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps({"profile": {"profileComplete": True}})))
    fixture_content = {
        "version": 5,
        "announcements": [],
        "postings": [
            {"id": "sunday-main-auditorium", "day": "Sunday", "name": "Main auditorium", "role": "Order", "columns": ["Team"], "rows": [{"id": "sun-row", "label": "1st Service", "assignments": [[{"name": "Existing Member", "email": ""}]]}]},
            {"id": "thursday-main-auditorium", "day": "Thursday", "name": "Main auditorium", "role": "Order", "columns": ["Team"], "rows": [{"id": "thu-row", "label": "Thursday Service", "assignments": [[{"name": "Existing Member", "email": ""}]]}]},
        ],
        "uniformItems": [],
        "uniformNote": "Uniform note",
        "uniformImageUrl": "",
    }
    page.route(
        "**/api/content",
        lambda route, request: route.fulfill(status=200, content_type="application/json", body=json.dumps(fixture_content)) if request.method == "GET" else route.continue_(),
    )
    page.route(
        "**/api/admin/postings/import?day=Sunday",
        lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({
                "title": "QC Weekly Postings",
                "documentId": "test-document",
                "fetchedAt": "2026-08-19T12:00:00.000Z",
                "warnings": [],
                "postings": [{
                    "id": "sunday-imported-foyer",
                    "day": "Sunday",
                    "name": "Imported foyer",
                    "role": "Imported from the approved Google Doc",
                    "columns": ["Team"],
                    "rows": [{"id": "sunday-imported-foyer-row-1", "label": "1st Service", "assignments": [[{"name": "Test Member", "email": "test.member@example.com"}]]}],
                }],
            }),
        ),
    )
    page.goto(f"{BASE_URL}/admin/dashboard", wait_until="domcontentloaded", timeout=60_000)

    page.get_by_role("button", name="Postings 1").click()
    page.get_by_label("Main auditorium, 1st Service, Team").wait_for()
    assert page.get_by_label("Main auditorium, 1st Service, Team").is_visible()
    assert page.get_by_role("button", name="Save Sunday postings").is_visible()
    assert page.get_by_role("button", name="Notify Team").is_visible()
    page.get_by_role("button", name="Fetch Sunday draft").click()
    page.get_by_text("Unsaved draft — review it, then save before notifying.").wait_for()
    page.get_by_role("button", name="Expand Imported foyer").click()
    assert page.get_by_label("Imported foyer, 1st Service, Team").input_value() == "Test Member <test.member@example.com>"
    assert page.get_by_role("button", name="Notify Team").is_disabled()

    page.get_by_label("Service day").select_option("Thursday")
    assert page.get_by_label("Main auditorium, Thursday Service, Team").is_visible()
    assert page.get_by_role("button", name="Save Thursday postings").is_visible()
    page.get_by_label("Service day").select_option("Sunday")
    page.locator("#homepage-content").screenshot(path=str(OUTPUT / "qc-admin-postings-desktop.png"))

    page.set_viewport_size({"width": 390, "height": 844})
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.locator("#homepage-content").screenshot(path=str(OUTPUT / "qc-admin-postings-mobile.png"))

    anonymous = browser.new_context().request
    response = anonymous.post(f"{BASE_URL}/api/admin/notifications", data={"section": "postings", "day": "Sunday"})
    assert response.status == 401

    print(f"console_errors={len(console_errors)}")
    assert not console_errors, console_errors
    browser.close()
