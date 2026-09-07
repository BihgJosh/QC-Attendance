from pathlib import Path
import os
from playwright.sync_api import sync_playwright
import json

ROOT = os.environ.get("TEST_BASE_URL", "http://localhost:3000")
OUT = Path("artifacts/member-auth")
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for name, width, height in [("desktop", 1440, 1000), ("mobile", 390, 844)]:
        page = browser.new_page(viewport={"width": width, "height": height})
        console_errors = []
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.route("**/api/member/login", lambda route, request: route.fulfill(status=200, content_type="application/json", body=json.dumps({"nextStep": "password"}) if json.loads(request.post_data or "{}").get("action") == "identify" else json.dumps({"success": True})))
        page.goto(f"{ROOT}/member/login", wait_until="networkidle")
        assert page.get_by_role("heading", name="Welcome back").is_visible()
        assert page.get_by_label("Team email").is_visible()
        assert page.get_by_role("button", name="Continue").is_visible()
        page.get_by_label("Team email").fill("member@example.com")
        page.get_by_role("button", name="Continue").click()
        page.get_by_label("Private password").wait_for(state="visible")
        assert page.get_by_label("Keep me logged in on this device").is_checked()
        page.get_by_label("Private password").fill("VisiblePass1")
        assert page.get_by_role("button", name="Sign in").is_visible()
        page.get_by_role("button", name="Use another email").click()
        page.route("**/api/member/login", lambda route, request: route.fulfill(status=200, content_type="application/json", body=json.dumps({"nextStep": "setup"}) if json.loads(request.post_data or "{}").get("action") == "identify" else json.dumps({"success": True})))
        page.get_by_label("Team email").fill("new-member@example.com")
        page.get_by_role("button", name="Continue").click()
        page.get_by_label("Create private password").wait_for(state="visible")
        assert page.get_by_label("Confirm private password").is_visible()
        assert page.get_by_label("Verification code").count() == 0
        assert page.get_by_role("button", name="Create password and sign in").is_visible()
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

    removed_shared_login = page.request.post(f"{ROOT}/api/admin/login", data={"password": "obsolete"})
    assert removed_shared_login.status == 404
    page.goto(f"{ROOT}/admin/dashboard", wait_until="networkidle")
    assert "/member/login" in page.url
    assert "next=%2Fadmin%2Fdashboard" in page.url or "next=/admin/dashboard" in page.url
    browser.close()

print("member auth UI and protected-route checks passed")
