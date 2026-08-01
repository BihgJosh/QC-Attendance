import os
from pathlib import Path
import os
from playwright.sync_api import sync_playwright

ROOT = os.environ.get("TEST_BASE_URL", "http://localhost:3000")
password = os.environ.get("BIRTHDAY_TEST_PASSWORD", "")
assert password, "BIRTHDAY_TEST_PASSWORD is required"
output = Path("artifacts/birthdays")
output.mkdir(parents=True, exist_ok=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for name, width, height in [("desktop", 1440, 1100), ("mobile", 390, 844)]:
        page = browser.new_page(viewport={"width": width, "height": height})
        response = page.request.post(f"{ROOT}/api/member/login", data={"email": "joshuaagusa001@gmail.com", "password": password})
        assert response.ok
        page.route("**/api/birthdays", lambda route: route.fulfill(status=200, content_type="application/json", body='{"birthdays":[{"name":"Joshua Agusa","dateLabel":"Today","daysUntil":0,"isToday":true},{"name":"Grace Emmanuel","dateLabel":"28 July","daysUntil":4,"isToday":false},{"name":"Moses James","dateLabel":"2 August","daysUntil":9,"isToday":false}]}'))
        page.goto(f"{ROOT}/#announcements", wait_until="networkidle")
        notice = page.get_by_text("QC celebrates").locator("..")
        assert page.get_by_text("Happy birthday to").is_visible()
        assert page.get_by_text("Joshua Agusa").is_visible()
        assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
        page.screenshot(path=str(output / f"birthday-{name}.png"), full_page=True)
        page.request.post(f"{ROOT}/api/member/logout")
        page.close()
    browser.close()

print("birthday notice desktop and mobile checks passed")
