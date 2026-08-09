from pathlib import Path
import json
import os
from playwright.sync_api import sync_playwright


OUTPUT = Path(r"C:\Users\firebat\.codex\visualizations\2026\07\23\019f9014-a001-7262-bfed-68eff40e102d")
BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:3000")


def inspect(browser, label: str, width: int, height: int) -> list[str]:
    errors: list[str] = []
    page = browser.new_page(viewport={"width": width, "height": height})
    page.set_default_navigation_timeout(90_000)
    page.context.add_cookies([{"name": "qcu_member_session", "value": "qcu-go-live-playwright-session-20260809", "url": BASE_URL}])
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)

    emergency_statuses = {
        "00000000-0000-4000-8000-000000000101": "Active",
        "00000000-0000-4000-8000-000000000102": "Open",
    }

    def mock_manager(route, request):
        body = json.loads(request.post_data or "{}")
        if body.get("action") == "checkPassword":
            payload = {"ok": True}
        elif body.get("action") == "getEmergencies":
            payload = {"ok": True, "data": {"emergencies": [
                {"id": emergency_id, "location": "Main Auditorium", "description": "QA emergency", "reported_by": "QA", "submitted_at": "2026-08-09T08:00:00Z", "status": status}
                for emergency_id, status in emergency_statuses.items()
            ]}}
        elif body.get("action") == "updateEmergency":
            emergency_statuses[body["emergencyId"]] = body["status"]
            payload = {"ok": True, "message": f"Emergency marked as {body['status'].lower()}."}
        elif body.get("action") == "generateReport":
            payload = {
                "ok": True,
                "url": "https://docs.google.com/spreadsheets/d/1eZPJiAX4tCTX8huAAFCRrUSRr5na34VqmzXFCiqjGu0/edit?pli=1&gid=1635578956#gid=1635578956",
                "workbookUrl": "https://docs.google.com/spreadsheets/d/1QuNstJwL2wxBgM-bwa83r8rU9PZNln3tmih6DOBG2oY/edit",
                "logRecordId": "test-log-record",
            }
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
    page.goto(f"{BASE_URL}/service-tools", wait_until="domcontentloaded")
    page.get_by_text("Service tools", exact=False).first.wait_for(state="visible")

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
    assert page.get_by_role("heading", name="Today's emergency actions").is_visible()
    page.get_by_role("button", name="Escalate").first.click()
    page.get_by_text("Emergency marked as escalated.", exact=True).wait_for()
    assert page.get_by_text("Escalated", exact=True).count() == 1
    page.get_by_role("button", name="Mark resolved").first.click()
    page.get_by_text("Emergency marked as resolved.", exact=True).wait_for()
    assert page.get_by_text("Resolved", exact=True).count() == 1
    page.get_by_role("button", name="View report").first.click()
    assert page.get_by_text("Full detailed report", exact=False).is_visible()
    assert page.get_by_text("Main auditorium", exact=True).is_visible()
    assert page.get_by_text("Preparedness", exact=True).is_visible()
    page.get_by_role("button", name="Generate document").click()
    page.get_by_text("Document generated successfully for 1st Service.").wait_for()
    assert "1eZPJiAX4tCTX8huAAFCRrUSRr5na34VqmzXFCiqjGu0" in page.get_by_role("link", name="Open generated document").get_attribute("href")
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
