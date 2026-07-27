from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = "http://localhost:3000"
OUT = Path("artifacts/member-auth")
OUT.mkdir(parents=True, exist_ok=True)

def read_admin_password():
    for line in Path(".env.local").read_text(encoding="utf-8").splitlines():
        if line.startswith("ADMIN_PASSWORD="):
            return line.split("=", 1)[1].strip().strip('"')
    return ""

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for name, width, height in [("desktop", 1440, 1000), ("mobile", 390, 844)]:
        page = browser.new_page(viewport={"width": width, "height": height})
        console_errors = []
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.goto(f"{ROOT}/member/login", wait_until="networkidle")
        assert page.get_by_role("heading", name="Welcome back").is_visible()
        assert page.get_by_label("Team email").is_visible()
        assert page.get_by_label("Password", exact=True).is_visible()
        assert page.get_by_role("button", name="Sign in").is_visible()
        page.get_by_label("Team email").fill("member@example.com")
        page.get_by_label("Password", exact=True).fill("VisiblePass1")
        email_style = page.get_by_label("Team email").evaluate("el => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor })")
        assert email_style["color"] == "rgb(15, 23, 42)", email_style
        assert email_style["background"] == "rgb(255, 255, 255)", email_style
        assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
        page.screenshot(path=str(OUT / f"login-{name}.png"), full_page=True)
        assert not console_errors, console_errors
        page.close()

    page = browser.new_page()
    page.goto(f"{ROOT}/", wait_until="networkidle")
    assert "/member/login" in page.url
    page.goto(f"{ROOT}/member/change-password", wait_until="networkidle")
    assert "/member/login" in page.url

    admin_password = read_admin_password()
    if admin_password:
        response = page.request.post(f"{ROOT}/api/admin/login", data={"password": admin_password})
        assert response.ok
        access_response = page.request.get(f"{ROOT}/api/admin/member-passwords")
        assert access_response.ok
        payload = access_response.json()
        assert any(member["email"] == "joshuaagusa001@gmail.com" for member in payload["members"])
        page.goto(f"{ROOT}/admin/dashboard", wait_until="networkidle")
        page.get_by_role("tab", name="Password resets").click()
        assert page.get_by_role("heading", name="Member password resets").is_visible()
        page.get_by_text("joshuaagusa001@gmail.com").wait_for(state="visible")
        page.screenshot(path=str(OUT / "admin-password-resets.png"), full_page=True)
    browser.close()

print("member auth UI and protected-route checks passed")
