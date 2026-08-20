from pathlib import Path
import base64
import json
import os
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / ".artifacts" / "profile-page"
ARTIFACTS.mkdir(parents=True, exist_ok=True)
BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:3000")
TEST_SESSION = "qcu-go-live-playwright-session-20260809"
PHOTO = base64.b64decode("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABAf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=")
PROFILE = {"profile": {"email": "mobile.test@example.com", "firstName": "Mobile", "middleName": "", "lastName": "Tester", "phone": "", "birthMonth": None, "birthDay": None, "avatarUrl": None, "role": "general_user", "profileComplete": True}}


def guard_test(browser, width, height):
    page = browser.new_page(viewport={"width": width, "height": height})
    page.set_default_navigation_timeout(90_000)
    page.goto(f"{BASE_URL}/member/profile", wait_until="domcontentloaded")
    assert "/member/login" in page.url
    assert "next=%2Fmember%2Fprofile" in page.url or "next=/member/profile" in page.url
    assert page.get_by_role("heading", name="Welcome back").is_visible()
    page.close()


def upload_test(browser, mode):
    telemetry = []
    console_errors = []
    page = browser.new_page(viewport={"width": 390, "height": 844}, user_agent="Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36")
    page.set_default_navigation_timeout(90_000)
    page.context.add_cookies([{"name": "qcu_member_session", "value": TEST_SESSION, "url": BASE_URL, "sameSite": "Strict"}])
    page.on("pageerror", lambda error: console_errors.append(str(error)))
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)

    page.route("**/api/member/profile", lambda route, request: route.fulfill(status=200, content_type="application/json", body=json.dumps(PROFILE)) if request.method == "GET" else route.fulfill(status=200, content_type="application/json", body='{"avatarUrl":"https://images.example.test/profile.webp"}'))
    page.route("**/api/member/profile/image/stage", lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps({"endpoint": f"{BASE_URL}/mock-tus/{mode}", "bucket": "member-profile-photo-staging", "objectPath": "test/source.jpg", "uploadToken": "header.payload.signature"})))
    page.route("**/api/member/profile/image", lambda route: route.fulfill(status=200, content_type="application/json", body='{"avatarUrl":"https://images.example.test/profile.webp"}'))

    def telemetry_route(route, request):
        telemetry.append(json.loads(request.post_data or "{}"))
        route.fulfill(status=204, body="")

    def tus_route(route, request):
        if mode == "failure":
            route.fulfill(status=403, content_type="application/json", body='{"message":"signed upload token rejected"}', headers={"Tus-Resumable": "1.0.0"})
            return
        if request.method == "POST":
            size = request.headers.get("upload-length", str(len(PHOTO)))
            route.fulfill(status=201, body="", headers={"Location": f"{BASE_URL}/mock-tus/success/upload-1", "Upload-Offset": size, "Tus-Resumable": "1.0.0"})
        elif request.method == "HEAD":
            route.fulfill(status=200, body="", headers={"Upload-Offset": str(len(PHOTO)), "Upload-Length": str(len(PHOTO)), "Tus-Resumable": "1.0.0"})
        else:
            route.fulfill(status=204, body="", headers={"Upload-Offset": str(len(PHOTO)), "Tus-Resumable": "1.0.0"})

    page.route("**/api/member/profile/image/telemetry", telemetry_route)
    page.route("**/mock-tus/**", tus_route)
    page.goto(f"{BASE_URL}/test-harness/profile-upload", wait_until="domcontentloaded")
    page.get_by_role("heading", name="Mobile Tester").wait_for()
    page.get_by_label("Choose profile picture").set_input_files({"name": "mobile-profile.jpg", "mimeType": "image/jpeg", "buffer": PHOTO})
    page.get_by_role("button", name="Upload", exact=True).click()

    if mode == "failure":
        page.get_by_text("Secure storage rejected the upload authorization (HTTP 403).", exact=False).first.wait_for(timeout=20_000)
        page.wait_for_timeout(250)
        assert telemetry and telemetry[-1]["phase"] == "transfer"
        assert telemetry[-1]["event"] == "failed"
        assert telemetry[-1]["status"] == 403
        assert telemetry[-1]["error"] == "signed upload token rejected"
    else:
        page.get_by_text("Profile picture updated.", exact=False).wait_for(timeout=20_000)
        page.wait_for_timeout(250)
        assert telemetry and telemetry[-1]["phase"] == "finalize"
        assert telemetry[-1]["event"] == "completed"
        assert telemetry[-1]["status"] == 200

    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.screenshot(path=str(ARTIFACTS / f"mobile-upload-{mode}.png"), full_page=True)
    page.close()
    unexpected_errors = [message for message in console_errors if not (mode == "failure" and "403 (Forbidden)" in message)]
    if unexpected_errors:
        raise AssertionError("Browser errors:\n" + "\n".join(unexpected_errors))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    guard_test(browser, 1440, 1000)
    guard_test(browser, 390, 844)
    upload_test(browser, "failure")
    upload_test(browser, "success")
    browser.close()

print("Profile guard plus mobile upload failure diagnostics and success flow passed.")
