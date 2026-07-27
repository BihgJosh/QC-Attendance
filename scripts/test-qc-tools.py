import json
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright


OUTPUT = Path(r"C:\Users\firebat\.codex\visualizations\2026\07\23\019f9014-a001-7262-bfed-68eff40e102d")
TOOLS = {
    "post-report": "Submit Report",
    "timer": "Submit Timer Log",
    "observer": "Submit Observer Report",
    "emergency": "Send Emergency Flag",
    "dashboard": "Unlock",
}


def mock_backend(route, request):
    query = parse_qs(urlparse(request.url).query)
    body = json.loads(request.post_data or "{}") if request.post_data else {}
    action = body.get("action") or query.get("action", [""])[0]
    if action == "checkEmergency":
        payload = {"ok": True, "serverNow": 1784900000000, "emergencies": []}
    elif action == "checkPassword":
        payload = {"ok": True}
    elif action == "getDashboard":
        payload = {"ok": True, "data": {"headcount": {"grandTotal": 0, "byDepartment": []}, "incidentCount": 0, "emergencies": [], "ratings": {}, "timer": None, "observer": None}}
    elif action == "generateReport":
        payload = {"ok": True, "url": "https://docs.google.com/document/d/example"}
    elif action == "getContext":
        payload = {
            "date": "2026-07-24",
            "time": "14:30",
            "areas": ["Main Auditorium", "Overflow", "Children Section", "Outside", "Observation", "Timers"],
            "ratings": ["Excellent", "Good", "Needs Improvement"],
            "overallRatings": ["Excellent", "Good", "Fair"],
            "units": ["Protocol", "Choir", "Media", "Children"],
            "segments": [{"id": "opening", "label": "Opening Prayer"}, {"id": "message", "label": "Message"}],
        }
    else:
        payload = {"ok": True, "message": "Saved successfully."}
    route.fulfill(status=200, content_type="application/json", body=json.dumps(payload))


def inspect(browser, tool: str, button_name: str, width: int, height: int):
    errors = []
    context = browser.new_context(viewport={"width": width, "height": height}, service_workers="block")
    page = context.new_page()
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.route("https://script.google.com/**", mock_backend)
    page.route("**/api/service-manager", mock_backend)
    page.goto(f"http://localhost:3000/qc-tools/{tool}", wait_until="domcontentloaded")
    page.locator(".qc-suite-nav").wait_for(state="visible")

    assert page.locator('link[href="/qc-suite-assets/shared.css"]').count() == 1
    assert page.locator(".qc-suite-nav").is_visible()
    assert page.locator('.qc-suite-brand[href="/"]').is_visible()
    assert page.get_by_role("button", name=button_name, exact=False).is_visible()
    assert page.locator('a[href^="https://"]').count() == 0
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

    if width < 821:
        assert page.get_by_label("Choose a QC tool").is_visible()
        assert page.get_by_label("Choose a QC tool").input_value()
    else:
        assert page.get_by_role("link", name="QC Tools", exact=True).is_visible()

        if tool == "timer":
            page.get_by_role("button", name="Submit Timer Log").click()
            assert page.get_by_text("Please select a service.", exact=True).is_visible()
        elif tool == "observer":
            page.get_by_role("button", name="Submit Observer Report").click()
            assert page.get_by_text("Please select a service.", exact=True).is_visible()
        elif tool == "emergency":
            page.locator("#reportedBy").fill("Test Observer")
            page.locator("#location").fill("Main Auditorium")
            page.locator("#description").fill("Test emergency workflow")
            page.get_by_role("button", name="Send Emergency Flag", exact=False).click()
            page.get_by_text("Saved successfully.", exact=True).wait_for(state="visible")
        elif tool == "dashboard":
            page.locator("#password").fill("test-password")
            page.get_by_role("button", name="Unlock").click()
            page.locator("#dashCard").wait_for(state="visible")
        elif tool == "post-report":
            page.locator("#service").select_option("1st Service")
            page.locator("#name").fill("Test Observer")
            page.locator("#area").select_option("Main Auditorium")
            for field in ("preparedness", "neatness", "orderliness", "conduct", "compliance", "coordination", "overallRating"):
                page.locator(f'.pill-row[data-field="{field}"] .pill').first.click()
            page.locator("#confirmAccurate").check()
            page.get_by_role("button", name="Submit Report").click()
            page.get_by_text("Saved successfully.", exact=True).wait_for(state="visible")

    page.screenshot(path=str(OUTPUT / f"qc-tool-{tool}-{'mobile' if width < 600 else 'desktop'}.png"), full_page=True)
    context.close()
    return errors


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    console_errors = []

    index_context = browser.new_context(viewport={"width": 1280, "height": 900}, service_workers="block")
    index = index_context.new_page()
    index.route("https://script.google.com/**", mock_backend)
    index.goto("http://localhost:3000/qc-tools", wait_until="domcontentloaded")
    index.locator(".qc-suite-nav").wait_for(state="visible")
    assert index.locator('a.card[href="/qc-tools/post-report"]').count() == 1
    assert index.locator('a[href^="https://"]').count() == 0
    index_context.close()

    for tool, button_name in TOOLS.items():
        console_errors.extend(inspect(browser, tool, button_name, 1280, 900))
        console_errors.extend(inspect(browser, tool, button_name, 390, 844))

    print(f"console_errors={len(console_errors)}")
    for error in console_errors:
        print(f"console_error={error}")
    browser.close()
