from pathlib import Path
import hashlib
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
    page.route("**/api/member/profile", lambda route: route.fulfill(status=200, content_type="application/json", body='{"profile":{"profileComplete":true}}'))
    page.goto(f"{BASE_URL}/admin/dashboard", wait_until="domcontentloaded", timeout=60_000)

    page.get_by_role("button", name="Postings 6").click()
    page.locator("button[aria-label^='Expand ']").first.click()
    assignment_inputs = page.locator("input[role='combobox'][aria-label^='Add member to']")
    sunday_assignment = assignment_inputs.first
    sunday_assignment.wait_for()
    assert sunday_assignment.is_visible()
    sunday_assignment.focus()
    first_suggestion = page.locator("div[role='listbox'] button[role='option']").first
    first_suggestion.wait_for()
    sunday_assignment.press("ArrowDown")
    selected_suggestion = page.locator("div[role='listbox'] button[role='option'][aria-selected='true']")
    suggestion_text = selected_suggestion.inner_text()
    sunday_assignment.press("Enter")
    suggestion_email = suggestion_text.splitlines()[-1]
    assert page.get_by_text(suggestion_email, exact=True).first.is_visible()
    page.get_by_role("button", name="Clear & start new").click()
    assert page.get_by_role("button", name="Clear draft").is_visible()
    page.get_by_role("button", name="Cancel").click()
    assert page.get_by_role("button", name="Save Sunday postings").is_visible()
    assert page.get_by_role("button", name="Notify Team").is_visible()
    sunday_assignment.focus()
    page.locator("#homepage-content").screenshot(path=str(OUTPUT / "qc-admin-postings-desktop.png"))

    page.get_by_label("Service day").select_option("Thursday")
    page.locator("button[aria-label^='Expand ']").first.click()
    assert page.locator("input[role='combobox'][aria-label^='Add member to']").first.is_visible()
    assert page.get_by_role("button", name="Save Thursday postings").is_visible()
    page.get_by_label("Service day").select_option("Sunday")
    page.locator("button[aria-label^='Expand ']").first.click()
    page.set_viewport_size({"width": 390, "height": 844})
    page.locator("input[role='combobox'][aria-label^='Add member to']").first.focus()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.locator("#homepage-content").screenshot(path=str(OUTPUT / "qc-admin-postings-mobile.png"))

    page.get_by_role("button", name="Clear & start new").click()
    page.get_by_role("button", name="Clear draft").click()
    assert page.locator("input[value='Service managers']").count() == 1

    anonymous = browser.new_context().request
    response = anonymous.post(f"{BASE_URL}/api/admin/notifications", data={"section": "postings", "day": "Sunday"})
    assert response.status == 401

    print(f"console_errors={len(console_errors)}")
    assert not console_errors, console_errors
    browser.close()
