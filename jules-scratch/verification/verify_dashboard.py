import os
from playwright.sync_api import sync_playwright, expect

def run_verification(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    base_path = os.path.abspath('.')
    main_page_url = f'file://{os.path.join(base_path, "main.html")}'

    try:
        # 1. Navigate to the main page and take a screenshot
        page.goto(main_page_url)
        expect(page).to_have_title("Análisis de Negocio - Hospital del Móvil")
        page.screenshot(path="jules-scratch/verification/01_main_page.png")

        # 2. Click the link to go to the "Ventas" tab (more likely to have data)
        ventas_link = page.get_by_role("link", name="Ir a Ventas")
        ventas_link.click()

        page.wait_for_url("**/index.html#ventas")

        # 3. Verify the "Ventas" tab is active and populated
        expect(page.locator("#ventas-table-body tr").first).to_be_visible(timeout=20000)
        ventas_tab_button = page.locator('button[data-tab="ventas"]')
        expect(ventas_tab_button).to_have_class("tab-button active")
        page.screenshot(path="jules-scratch/verification/02_ventas_tab.png")

        # 4. Find and click a "Folio Recepción Final" link to trace to the "Servicios" tab
        folio_recepcion_link = page.locator('span.trace-link[data-target-tab="servicios"]').first
        folio_value = folio_recepcion_link.inner_text()
        folio_recepcion_link.click()

        # 5. Verify the "Servicios" tab is now active and the filter is applied
        # Wait for the filter status to appear. This is the primary verification.
        filter_status = page.locator("#folio-filter-status")
        expect(filter_status).to_be_visible(timeout=15000)
        expect(filter_status).to_contain_text(f"Filtrando por Folio: {folio_value}")

        # Check that the correct tab is active
        servicios_tab_button = page.locator('button[data-tab="servicios"]')
        expect(servicios_tab_button).to_have_class("tab-button active")

        # The servicios table itself might be empty, but the filter status proves the link worked.
        page.screenshot(path="jules-scratch/verification/03_filtered_servicios_tab.png")

        # 6. Clear the filter and verify it's gone
        clear_button = filter_status.get_by_text("(quitar)")
        clear_button.click()
        expect(filter_status).not_to_be_visible()
        page.screenshot(path="jules-scratch/verification/04_filter_cleared.png")

        print("Verification script completed successfully!")

    except Exception as e:
        print(f"An error occurred during verification: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run_verification(playwright)