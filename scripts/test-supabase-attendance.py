from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import json

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]


def env_values() -> dict[str, str]:
    values: dict[str, str] = {}
    for filename in (".env", ".env.local"):
        path = ROOT / filename
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                values[key] = value.strip().strip('"').strip("'")
    return values


env = env_values()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    console_errors: list[str] = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)

    page.goto("http://localhost:3000", wait_until="networkidle")
    status = page.request.get("http://localhost:3000/api/status")
    whitelist = page.request.get("http://localhost:3000/api/whitelist")
    assert status.ok
    assert whitelist.ok
    assert len(whitelist.json()["names"]) == 94

    page.goto("http://localhost:3000/admin/login", wait_until="networkidle")
    page.get_by_label("Admin Password").fill(env["ADMIN_PASSWORD"])
    page.get_by_role("button", name="Access Dashboard").click()
    page.wait_for_url("**/admin/dashboard")
    page.wait_for_load_state("networkidle")
    settings = page.request.get("http://localhost:3000/api/admin/settings")
    assert settings.ok, settings.text()
    assert settings.json()["locationName"] == "Abuja"
    assert settings.json()["timezoneLabel"] == "WAT"
    page.get_by_text("Abuja Church Latitude", exact=True).wait_for()
    page.get_by_text("Abuja Church Longitude", exact=True).wait_for()

    attendance = page.request.get("http://localhost:3000/api/admin/attendance")
    assert attendance.ok
    records = attendance.json()
    assert len(records) == 58
    expected = {"date", "service", "memberName", "time", "latitude", "longitude", "distance", "status", "reason", "browser", "device", "deviceId"}
    assert all(expected.issubset(record.keys()) for record in records)
    assert all(record["status"] == "Approved" for record in records)

    browser.close()

# Direct Data API access must remain unavailable even with the public anon key.
request = Request(
    f'{env["SUPABASE_URL"]}/rest/v1/attendance_records?select=id&limit=1',
    headers={"apikey": env["SUPABASE_ANON_KEY"], "Authorization": f'Bearer {env["SUPABASE_ANON_KEY"]}'},
)
try:
    with urlopen(request, timeout=20) as response:
        direct_status = response.status
except HTTPError as error:
    direct_status = error.code

assert direct_status in (401, 403), f"Attendance table unexpectedly exposed with HTTP {direct_status}"

# The human shared password must not authenticate directly to the Edge gateway.
gateway_request = Request(
    f'{env["SUPABASE_URL"]}/functions/v1/qcu-attendance',
    data=json.dumps({"operation": "status.get"}).encode("utf-8"),
    method="POST",
    headers={
        "Content-Type": "application/json",
        "apikey": env["SUPABASE_ANON_KEY"],
        "Authorization": f'Bearer {env["SUPABASE_ANON_KEY"]}',
        "x-qcu-operation-secret": env["SHARED_PASSWORD"],
    },
)
try:
    with urlopen(gateway_request, timeout=20) as response:
        shared_password_gateway_status = response.status
except HTTPError as error:
    shared_password_gateway_status = error.code

assert shared_password_gateway_status == 401
print(json.dumps({"members": 94, "attendance_records": 58, "direct_table_status": direct_status, "shared_password_gateway_status": shared_password_gateway_status, "console_errors": len(console_errors)}))
