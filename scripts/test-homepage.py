from pathlib import Path
from playwright.sync_api import sync_playwright


OUTPUT = Path(r"C:\Users\firebat\.codex\visualizations\2026\07\23\019f9014-a001-7262-bfed-68eff40e102d")


def inspect(browser, label: str, width: int, height: int) -> list[str]:
    console_errors = []
    failed_responses = []
    page = browser.new_page(viewport={"width": width, "height": height})
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("response", lambda response: failed_responses.append(f"{response.status} {response.url}") if response.status >= 400 else None)
    page.goto("http://localhost:3000", wait_until="networkidle")
    assert page.get_by_text("Abuja date", exact=True).is_visible()
    page.wait_for_timeout(1200)

    assert page.get_by_role("heading", name="We guard the standard behind every service.").is_visible()
    tools_link = page.get_by_role("link", name="QC Service Tools Post reports, service timing, observations and emergency flags.")
    assert tools_link.is_visible()
    assert tools_link.get_attribute("href") == "/service-tools"
    assert page.get_by_role("heading", name="Know the brief before you take your post.").is_visible()
    assert page.get_by_role("heading", name="Simple. Sharp. Service-ready.").is_visible()
    assert page.get_by_role("heading", name="Every member. Every post. One clear view.").is_visible()

    posting_panel = page.get_by_test_id("posting-panel")
    posting_panel.scroll_into_view_if_needed()
    assert page.get_by_text("Members posted here").is_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

    if width >= 1024:
        posting_box = posting_panel.bounding_box()
        uniform_box = page.get_by_test_id("uniform-panel").bounding_box()
        assert posting_box and uniform_box
        assert abs(posting_box["width"] - uniform_box["width"]) < 2
        assert uniform_box["y"] > posting_box["y"] + posting_box["height"]

    assert page.locator("#attendance").count() == 0
    assert page.get_by_role("link", name="Attendance", exact=True).count() == 0

    for section_id in ("announcements", "postings", "uniform"):
        page.locator(f"#{section_id}").scroll_into_view_if_needed()
        page.wait_for_timeout(400)

    page.locator("#home").scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUTPUT / f"qc-home-{label}.png"), full_page=True)

    print(f"{label}_title={page.title()}")
    for failure in failed_responses:
        print(f"{label}_failed_response={failure}")
    page.close()
    return console_errors


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    console_errors = []
    console_errors.extend(inspect(browser, "desktop", 1440, 1000))
    console_errors.extend(inspect(browser, "tablet", 820, 1180))
    console_errors.extend(inspect(browser, "mobile", 390, 844))
    print(f"console_errors={len(console_errors)}")
    for error in console_errors:
        print(f"console_error={error}")

    browser.close()
