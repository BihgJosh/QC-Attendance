from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / ".artifacts" / "profile-page"
ARTIFACTS.mkdir(parents=True, exist_ok=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    errors = []
    for name, viewport in (("desktop", {"width": 1440, "height": 1000}), ("mobile", {"width": 390, "height": 844})):
        page = browser.new_page(viewport=viewport)
        page.on("pageerror", lambda error: errors.append(f"page:{error}"))
        page.goto("http://127.0.0.1:3000/member/profile", wait_until="networkidle")
        assert "/member/login" in page.url
        assert "next=%2Fmember%2Fprofile" in page.url or "next=/member/profile" in page.url
        assert page.get_by_role("heading", name="Welcome back").is_visible()
        page.screenshot(path=str(ARTIFACTS / f"{name}.png"), full_page=True)
        page.close()
    browser.close()

if errors:
    raise AssertionError("Browser errors:\n" + "\n".join(errors))

print("Profile navigation and authenticated-route guard passed at desktop and mobile widths.")
