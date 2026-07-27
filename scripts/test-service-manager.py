from pathlib import Path
import json
from playwright.sync_api import sync_playwright


OUTPUT = Path(r"C:\Users\firebat\.codex\visualizations\2026\07\23\019f9014-a001-7262-bfed-68eff40e102d")


def inspect(browser, label: str, width: int, height: int) -> list[str]:
    errors: list[str] = []
    page = browser.new_page(viewport={"width": width, "height": height})
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)

    def mock_manager(route, request):
        body = json.loads(request.post_data or "{}")
        if body.get("action") == "checkPassword":
            payload = {"ok": True}
        else:
            service_number = ["1st Service", "2nd Service", "3rd Service", "4th Service", "Thursday Service"].index(body["service"]) + 1
            payload = {"ok": True, "data": {
                "headcount": {"grandTotal": service_number * 100, "byDepartment": [{"department": "Main auditorium", "adults": service_number * 80, "children": service_number * 20, "total": service_number * 100}]},
                "incidentCount": service_number - 1,
                "emergencies": [],
                "ratings": {"Preparedness": "Excellent", "Orderliness": "Good"},
                "timer": {"timerName": "QC Timer", "serviceStart": "07:00", "serviceEnd": "09:00", "segments": [{"label": "Opening prayer", "status": "On Time"}]},
                "observer": {"observerName": "QC Observer", "generalObservations": "Service remained orderly.", "unitReports": {"Protocol": "Team was prepared."}, "recommendations": "Maintain the standard.", "conclusion": "Strong service."},
            }}
        route.fulfill(status=200, content_type="application/json", body=json.dumps(payload))

    page.route("**/api/service-manager", mock_manager)
    page.goto("http://localhost:3000/service-tools", wait_until="networkidle")

    manager_card = page.get_by_role("article").filter(has_text="Service Manager")
    manager_card.get_by_role("button", name="Open service summary").click()
    workflow = page.locator("#workflow")
    workflow.get_by_role("heading", name="Service Manager", exact=True).wait_for(state="visible")

    assert page.get_by_label("Manager password").is_visible()
    assert page.get_by_role("button", name="Open service summary").last.is_disabled()
    assert page.locator('a[href*="/dashboard/"]').count() == 0
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

    page.get_by_label("Manager password").fill("test-password")
    page.get_by_role("button", name="Open service summary").last.click()
    page.get_by_role("heading", name="All services at a glance.").wait_for(state="visible")
    assert page.get_by_text("1500", exact=True).is_visible()
    assert page.get_by_role("button", name="View report").count() == 5
    page.get_by_role("button", name="View report").first.click()
    assert page.get_by_text("Full detailed report", exact=False).is_visible()
    assert page.get_by_text("Main auditorium", exact=True).is_visible()
    assert page.get_by_text("Preparedness", exact=True).is_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

    workflow.screenshot(path=str(OUTPUT / f"qc-service-manager-{label}.png"))
    page.close()
    return errors


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    console_errors: list[str] = []
    console_errors.extend(inspect(browser, "desktop", 1440, 1000))
    console_errors.extend(inspect(browser, "mobile", 390, 844))
    print(f"console_errors={len(console_errors)}")
    for error in console_errors:
        print(f"console_error={error}")
    browser.close()
