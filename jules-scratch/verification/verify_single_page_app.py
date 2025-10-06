import os
from playwright.sync_api import sync_playwright, expect

def run_verification(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    base_path = os.path.abspath('.')
    app_url = f'file://{os.path.join(base_path, "index.html")}'

    try:
        # 1. Navigate to the app and verify the landing page is shown
        page.goto(app_url)
        landing_view = page.locator("#landing-view")
        dashboard_view = page.locator("#dashboard-view")

        expect(landing_view).to_be_visible()
        expect(dashboard_view).not_to_be_visible()
        page.screenshot(path="jules-scratch/verification/01_landing_page_view.png")

        # 2. Click a link to navigate to the dashboard
        ventas_link = landing_view.get_by_role("link", name="Ir a Ventas")
        ventas_link.click()

        # 3. Verify the dashboard is visible and the correct tab is active
        expect(dashboard_view).to_be_visible(timeout=15000)
        expect(landing_view).not_to_be_visible()

        # Wait for the table to be populated to ensure data has loaded
        expect(page.locator("#ventas-table-body tr").first).to_be_visible(timeout=20000)

        ventas_tab_button = page.locator('button[data-tab="ventas"]')
        expect(ventas_tab_button).to_have_class("tab-button active")
        page.screenshot(path="jules-scratch/verification/02_dashboard_view_ventas.png")

        # 4. Test the "Go Back" button
        back_button = page.locator("#back-to-landing")
        expect(back_button).to_be_visible()
        back_button.click()

        # 5. Verify we are back on the landing page
        expect(landing_view).to_be_visible()
        expect(dashboard_view).not_to_be_visible()
        page.screenshot(path="jules-scratch/verification/03_back_to_landing_view.png")

        print("Single-page navigation verification script completed successfully!")

    except Exception as e:
        print(f"An error occurred during verification: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run_verification(playwright)