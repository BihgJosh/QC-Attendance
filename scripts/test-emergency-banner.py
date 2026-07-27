from playwright.sync_api import sync_playwright
from pathlib import Path


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.set_content("<!doctype html><html><head></head><body></body></html>")
    page.add_script_tag(
        path=str(Path(__file__).parents[1] / "public" / "qc-suite-assets" / "emergency-notify.js")
    )
    page.wait_for_function("Boolean(window.__qcuEmergencyAlerts)")
    page.evaluate(
        """window.__qcuEmergencyAlerts.add([{
          location: 'Main Auditorium',
          description: 'A member needs immediate medical assistance.',
          reportedBy: 'Test Member'
        }])"""
    )

    banner = page.locator("#soj-emg-alert-container")
    banner.wait_for(state="visible")
    assert banner.locator(".headline").inner_text() == "Main Auditorium"
    assert banner.get_attribute("aria-expanded") == "false"
    assert page.evaluate(
        "getComputedStyle(document.querySelector('#soj-emg-alert-container')).position"
    ) == "fixed"
    assert page.evaluate(
        "getComputedStyle(document.querySelector('#soj-emg-alert-container .copy')).animationName"
    ) == "soj-emg-ticker"
    assert banner.get_by_role("button", name="Dismiss emergency alert").is_visible()

    banner.click()
    assert banner.get_attribute("aria-expanded") == "true"
    assert banner.locator(".description").is_visible()

    box = banner.bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + 25)
    page.mouse.down()
    page.mouse.move(box["x"] + box["width"] / 2 + 130, box["y"] + 25, steps=5)
    page.mouse.up()
    banner.wait_for(state="detached")

    browser.close()
