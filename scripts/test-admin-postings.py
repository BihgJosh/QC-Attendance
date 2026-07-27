from pathlib import Path
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(r"C:\Users\firebat\.codex\visualizations\2026\07\23\019f9014-a001-7262-bfed-68eff40e102d")


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

    page.goto("http://localhost:3000/admin/login", wait_until="networkidle")
    page.get_by_label("Admin Password").fill(admin_password())
    page.get_by_role("button", name="Access Dashboard").click()
    page.wait_for_url("**/admin/dashboard")
    page.wait_for_load_state("networkidle")

    page.get_by_role("button", name="Postings 6").click()
    page.get_by_text("Service teamsheet").first.wait_for()
    assert page.get_by_label("Main auditorium, 1st Service, Team").is_visible()
    assert page.get_by_role("button", name="Save Sunday postings").is_visible()

    page.get_by_label("Service day").select_option("Thursday")
    assert page.get_by_label("Main auditorium, Thursday Service, Team").is_visible()
    assert page.get_by_role("button", name="Save Thursday postings").is_visible()
    page.get_by_label("Service day").select_option("Sunday")
    page.locator("#homepage-content").screenshot(path=str(OUTPUT / "qc-admin-postings-desktop.png"))

    page.set_viewport_size({"width": 390, "height": 844})
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.locator("#homepage-content").screenshot(path=str(OUTPUT / "qc-admin-postings-mobile.png"))

    print(f"console_errors={len(console_errors)}")
    browser.close()
