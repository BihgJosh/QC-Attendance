from pathlib import Path

from playwright.sync_api import sync_playwright


OUTPUT = Path(r"C:\Users\firebat\.codex\visualizations\2026\07\23\019f9014-a001-7262-bfed-68eff40e102d")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    console_errors: list[str] = []

    for label, width, height in (("desktop", 1440, 1000), ("tablet", 820, 1180), ("mobile", 390, 844)):
        page = browser.new_page(viewport={"width": width, "height": height})
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.goto("http://localhost:3000/service-tools", wait_until="networkidle")

        assert page.get_by_role("heading", name="One service. One clear record.").is_visible()
        assert page.get_by_role("heading", name="The right tool for every QC role.").is_visible()
        for tool in ("Service Post", "Service Timer", "Observer Report", "Emergency Flag", "Service Manager"):
            assert page.get_by_role("heading", name=tool, exact=True).first.is_visible()

        page.get_by_role("button", name="Timer").click()
        assert page.get_by_text("Minutes and seconds for each timing variance", exact=True).is_visible()
        page.get_by_role("button", name="Emergency").click()
        assert page.get_by_text("Immediate submission to the emergency feed", exact=True).is_visible()

        assert page.locator('a[href="/qc-tools/post-report"]').count() >= 1
        assert page.locator('a[href^="https://"]').count() == 0
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.screenshot(path=str(OUTPUT / f"qc-service-tools-{label}.png"), full_page=True)
        page.close()

    home = browser.new_page(viewport={"width": 1440, "height": 900})
    home.goto("http://localhost:3000", wait_until="networkidle")
    assert home.get_by_role("link", name="Service Tools", exact=True).first.get_attribute("href") == "/service-tools"
    home.close()

    print(f"console_errors={len(console_errors)}")
    browser.close()
