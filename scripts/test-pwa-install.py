from pathlib import Path
from playwright.sync_api import sync_playwright


OUTPUT = Path("artifacts/pwa")
OUTPUT.mkdir(parents=True, exist_ok=True)
BASE_URL = "http://localhost:3101"


def dispatch_install_prompt(page):
    page.evaluate(
        """
        () => {
          const event = new Event("beforeinstallprompt", { cancelable: true });
          event.prompt = async () => {};
          event.userChoice = Promise.resolve({ outcome: "dismissed" });
          window.dispatchEvent(event);
        }
        """
    )


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)

    page = browser.new_page(viewport={"width": 390, "height": 844})
    errors = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.goto(f"{BASE_URL}/member/login", wait_until="domcontentloaded", timeout=60_000)
    page.get_by_role("heading", name="Welcome back").wait_for()
    page.wait_for_timeout(750)
    dispatch_install_prompt(page)
    prompt = page.get_by_label("Install QC unit app")
    prompt.wait_for()
    assert prompt.get_by_text("Install QC unit app", exact=True).is_visible()
    assert prompt.get_by_role("button", name="Install", exact=True).is_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.screenshot(path=str(OUTPUT / "install-prompt-mobile.png"), full_page=True)
    prompt.get_by_role("button", name="Dismiss install prompt").click()
    assert prompt.is_hidden()
    assert page.evaluate("Number(localStorage.getItem('qcu-install-prompt-dismissed-until')) > Date.now()")
    assert not errors, errors
    page.close()

    tools = browser.new_page(viewport={"width": 1280, "height": 800})
    tools.goto(f"{BASE_URL}/qc-suite-assets/index.html", wait_until="domcontentloaded", timeout=60_000)
    tools.locator("body").wait_for()
    tools.wait_for_timeout(250)
    dispatch_install_prompt(tools)
    static_prompt = tools.get_by_label("Install QC unit app")
    static_prompt.wait_for()
    assert static_prompt.get_by_text("Install QC unit app", exact=True).is_visible()
    assert static_prompt.get_by_role("button", name="Install", exact=True).is_visible()
    tools.screenshot(path=str(OUTPUT / "install-prompt-service-tools.png"), full_page=True)
    tools.close()

    browser.close()

print("PWA install prompt checks passed")
