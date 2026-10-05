"""End-to-end smoke test: drives every main flow and fails on any JS error.
Usage:  pip install playwright && playwright install chromium
        python tests/e2e_smoke.py
"""
import asyncio, pathlib, sys
URL = (pathlib.Path(__file__).resolve().parent.parent / "index.html").as_uri()
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':1440,'height':1000})
        errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto(URL)
        await pg.wait_for_timeout(1500)
                # Priya: mark ready, confirm, address edit, save
        await pg.click('[data-act=mark-ready]')
        await pg.click('.wa-btn >> nth=0'); await pg.wait_for_timeout(900)
        await pg.click('.wa-btn:has-text("Move the pin")'); await pg.wait_for_timeout(900)
        await pg.click('.map-edit', position={'x':150,'y':40}); 
        await pg.click('.wa-btn:has-text("Save location")'); await pg.wait_for_timeout(900)
        # Ravi SMS: mark ready, cancel ->no cash -> UPI
        await pg.click('[data-id="MSH-48233"].q-item')
        await pg.click('[data-act=mark-ready]')
        await pg.click('.sms-key >> nth=2'); await pg.wait_for_timeout(900)
        await pg.click('.sms-key >> nth=1'); await pg.wait_for_timeout(900)
        await pg.click('.sms-key >> nth=0'); await pg.wait_for_timeout(900)
        # Imran hindi, ready, then ff to auto-cancel
        await pg.click('[data-id="MSH-48262"].q-item')
        await pg.click('[data-act=lang][data-lang=hi]')
        await pg.click('[data-act=mark-ready]')
        # Sunita change date payday
        await pg.click('[data-id="MSH-48270"].q-item')
        await pg.click('[data-act=mark-ready]')
        await pg.click('.wa-btn:has-text("Change date")'); await pg.wait_for_timeout(900)
        await pg.click('.wa-btn:has-text("Payday")'); await pg.wait_for_timeout(900)
        await pg.click('[data-act=ready-all]')
        for _ in range(3): await pg.click('[data-act=ff][data-h="6"]')
        await pg.click('[data-id="MSH-48262"].q-item')
        # pilot
        await pg.click('#tab-pilot'); await pg.wait_for_timeout(300)
        await pg.click('[data-act=p-open] >> nth=0')
        await pg.click('[data-act=p-call]'); await pg.wait_for_timeout(7000)
        await pg.click('[data-act=p-endcall]')
        await pg.click('[data-act=p-photo]')
        await pg.click('[data-act=p-outcome][data-o=unavailable]')
        await pg.click('[data-act=p-submit]')
        await pg.click('.pa-btn:has-text("Back to parcels")')
        await pg.check('#sim-reuse')
        await pg.click('[data-act=p-open] >> nth=1')
        await pg.click('[data-act=p-photo]')
        await pg.click('[data-act=p-outcome][data-o=delivered]')
        await pg.click('[data-act=p-submit]')
        await pg.fill('#sim-gps','300'); await pg.dispatch_event('#sim-gps','input')
        await pg.click('[data-act=p-nav][data-screen=tasks]')
        await pg.click('[data-act=p-open] >> nth=0')
        await pg.click('[data-act=p-outcome][data-o=unavailable]')
        await pg.click('[data-act=p-nav][data-screen=tier]') if await pg.query_selector('[data-act=p-nav]') else None
        await pg.click('[data-act=p-back]') if await pg.query_selector('[data-act=p-back]') else None
        await pg.click('[data-act=p-nav][data-screen=tier]')
        await pg.click('#tab-impact'); await pg.wait_for_timeout(300)
        m = await b.new_page(viewport={'width':390,'height':844})
        m.on('pageerror', lambda e: errs.append(str(e)))
        await m.goto(URL); await m.wait_for_timeout(800)
        w = await m.evaluate('document.documentElement.scrollWidth')
        assert w <= 390, f'horizontal overflow on mobile: {w}px'
        d = await b.new_page(viewport={'width':1440,'height':1000}, color_scheme='dark')
        await d.goto(URL); await d.wait_for_timeout(800)
        print('JS errors:', errs or 'none')
        if errs: sys.exit(1)
        await b.close()
asyncio.run(main())
