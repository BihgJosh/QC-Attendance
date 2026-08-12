from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3100"
OUTPUT = Path(r"C:\Users\firebat\.codex\visualizations\2026\08\11\019ff0cd-2b69-7830-a93a-f1f1de8fffd0")
ROUTES = {
    "home": "/",
    "attendance": "/attendance",
    "member-login": "/member/login",
    "admin-login": "/admin/login",
}
VIEWPORTS = {"desktop": (1440, 1000), "mobile": (390, 844)}

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    errors = []
    for route_name, route in ROUTES.items():
        for viewport_name, (width, height) in VIEWPORTS.items():
            page = browser.new_page(viewport={"width": width, "height": height})
            page.on("console", lambda message, label=f"{route_name}-{viewport_name}": errors.append(f"{label}: {message.text}") if message.type == "error" else None)
            page.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(1500)
            assert page.locator("body").is_visible()
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
            page.screenshot(path=str(OUTPUT / f"apple-refurb-{route_name}-{viewport_name}.png"), full_page=True)
            print(f"verified={route_name}-{viewport_name} title={page.title()}")
            page.close()
    print(f"console_errors={len(errors)}")
    for error in errors:
        print(f"console_error={error}")
    browser.close()
