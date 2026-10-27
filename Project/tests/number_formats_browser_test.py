"""Real editing, precision, units and persistence for formatted area/rent fields."""
import unittest
from playwright.sync_api import expect
import browser_test as harness


class NumberFormatsBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.BrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.BrowserTests.tearDownClass.__func__)
    setUp = harness.BrowserTests.setUp
    tearDown = harness.BrowserTests.tearDown

    def seed(self, unit='psfyr', rent=19.125):
        self.page.set_viewport_size({'width': 1440, 'height': 900})
        self.page.evaluate('''({unit,rent})=>{
          S.tenants=S.tenants.slice(0,2);
          Object.assign(S.tenants[0],{name:'Format Tenant',sf:12345.6789,rent,rentBasis:unit,step:0,sched:[]});
          DIRTY();setMode('inputs');go('tenants','rr');
        }''', {'unit':unit, 'rent':rent})
        self.page.wait_for_function('!!R && !calcPending')

    def row(self):
        return self.page.locator('#pane table.kgrid tbody tr').first

    def drawer(self):
        self.page.get_by_role('button', name='Edit lease for Format Tenant', exact=True).click()
        drawer = self.page.locator('.basis-lease-drawer')
        drawer.locator('summary', has_text='Rent and Recoveries').click()
        return drawer

    def test_display_rounding_never_overwrites_full_precision_on_focus_or_enter(self):
        self.seed()
        area = self.row().locator('[data-number-format=sf]')
        rent = self.row().locator('[data-number-format=psf]')
        expect(area).to_have_value('12,346');expect(rent).to_have_value('$19.13')
        before = self.page.evaluate('JSON.stringify(S)')
        area.focus();expect(area).to_have_value('12345.6789');area.press('Tab')
        expect(area).to_have_value('12,346')
        rent.focus();expect(rent).to_have_value('19.125');rent.press('Enter')
        expect(rent).to_have_value('$19.13')
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'),before)

    def test_currency_paste_decimals_save_reload_and_native_roundtrip(self):
        self.seed('yramt',125000)
        drawer = self.drawer();rent = drawer.get_by_label('Base Rent',exact=True)
        expect(rent).to_have_value('$125,000')
        rent.fill('$125,000.1256');rent.press('Tab')
        expect(rent).to_have_value('$125,000.13')
        self.assertEqual(self.page.evaluate('S.tenants[0].rent'),125000.1256)
        rent.focus();expect(rent).to_have_value('125000.1256')
        rent.fill('125000.50');rent.press('Tab')
        expect(rent).to_have_value('$125,000.50')
        drawer.get_by_role('button',name='Close Lease Editor',exact=True).click()
        self.page.evaluate('pwSaveCur()')
        self.page.reload();self.page.evaluate('PW.ready')
        self.page.wait_for_function('PW.cur && S.tenants[0].name==="Format Tenant"')
        self.assertEqual(self.page.evaluate('S.tenants[0].rent'),125000.5)
        result=self.page.evaluate('''async()=>{
          const decoded=await basisReadArchive(new Blob([await basisCreateArchive({kind:'property',model:S})]));
          return {rent:decoded.model.tenants[0].rent,sf:decoded.model.tenants[0].sf,type:typeof decoded.model.tenants[0].rent};
        }''')
        self.assertEqual(result,{'rent':125000.5,'sf':12345.6789,'type':'number'})

    def test_invalid_paste_keeps_saved_value_and_can_be_corrected(self):
        self.seed('yramt',125000)
        drawer=self.drawer();rent=drawer.get_by_label('Base Rent',exact=True)
        rent.fill('$12,34oops');rent.press('Tab')
        expect(rent).to_have_value('$12,34oops');expect(rent).to_have_attribute('aria-invalid','true')
        self.assertEqual(self.page.evaluate('S.tenants[0].rent'),125000)
        self.assertIn('saved value has not changed',rent.evaluate('(n)=>n.validationMessage'))
        rent.fill('$12,345.67');rent.press('Tab')
        expect(rent).to_have_value('$12,345.67');expect(rent).not_to_have_attribute('aria-invalid','true')
        self.assertEqual(self.page.evaluate('S.tenants[0].rent'),12345.67)

    def test_changing_units_updates_format_without_converting_values_or_percentages(self):
        self.seed('psfyr',1234)
        drawer=self.drawer();unit=drawer.get_by_label('Base Rent Unit',exact=True)
        rent=drawer.get_by_label('Base Rent',exact=True)
        for value,display in [('yramt','$1,234'),('moamt','$1,234'),('psfmo','$1,234.00'),('psfyr','$1,234.00')]:
            unit.select_option(value);expect(rent).to_have_value(display)
            self.assertEqual(self.page.evaluate('S.tenants[0].rent'),1234)
        unit.select_option('mkt')
        percent=drawer.get_by_label('% of Market',exact=True);percent.fill('95');percent.press('Tab')
        self.assertEqual(self.page.evaluate('S.tenants[0].rentPct'),.95)
        self.assertEqual(percent.get_attribute('type'),'number')
        unit.select_option('yramt');expect(rent).to_have_value('$1,234')

    def test_area_paste_keyboard_navigation_and_zero_keep_numeric_model_values(self):
        self.seed()
        area=self.row().locator('[data-number-format=sf]')
        area.fill('25,000.25');area.press('Enter')
        expect(area).to_have_value('25,000')
        self.assertEqual(self.page.evaluate('S.tenants[0].sf'),25000.25)
        expect(self.page.locator('#pane table.kgrid tbody tr').nth(1).locator('[data-number-format=sf]')).to_be_focused()
        area.fill('0');area.press('Tab');expect(area).to_have_value('0')
        self.assertEqual(self.page.evaluate('S.tenants[0].sf'),0)
        area.fill('');area.press('Tab');expect(area).to_have_value('0')
        self.page.evaluate('recalcInBackground()')
        self.assertEqual(self.page.evaluate('S.tenants[0].sf'),0)

    def test_market_link_remains_linked_until_a_rate_is_actually_edited(self):
        self.page.evaluate("setMode('inputs');go('market','ml')")
        self.page.locator('#pane .views').get_by_role('button',name='All',exact=True).click()
        rate=self.page.locator('#pane .ref .basis-number').first
        before=self.page.evaluate('JSON.stringify(S.mlas[0])')
        rate.focus();rate.press('Tab')
        self.assertEqual(self.page.evaluate('JSON.stringify(S.mlas[0])'),before)
        rate.fill('$27.125');rate.press('Tab')
        self.assertEqual(self.page.evaluate('[S.mlas[0].mrNewRef,S.mlas[0].mrNewLocal]'),['',27.125])
        expect(rate).to_have_value('$27.13')

    def test_base_schedule_retains_annual_and_monthly_units_and_actual_rent(self):
        self.seed('yramt',120000)
        self.page.evaluate("Object.assign(S.tenants[0],{sf:1000,start:'2026-01',end:'2030-12'});DIRTY();drawPane()")
        drawer=self.drawer();drawer.locator('summary',has_text='Rent Schedule').click()
        for unit,value,expected_monthly in [('yramt',120000,10000),('moamt',8500.5,8500.5),('psfmo',2.5,2500)]:
            self.page.evaluate('''({unit,value})=>{Object.assign(S.tenants[0],{rentBasis:unit,rent:value,sched:[]});DIRTY();drawPane();}''',{'unit':unit,'value':value})
            drawer.get_by_role('button',name='+ Base',exact=True).click()
            self.assertEqual(self.page.evaluate('[S.tenants[0].sched[0].units,S.tenants[0].sched[0].amt]'),[unit,value])
            # Independent flat-rent oracle: total annual / 12, total monthly, or monthly PSF * area.
            monthly=self.page.evaluate('''()=>{const t=S.tenants[0];return resolveSched(t.sched,sSer(t.start),t.sf,t.rent,t.rentBasis,0,eSer(t.end),1,()=>0,null)[0].monthly;}''')
            self.assertAlmostEqual(monthly,expected_monthly,places=8)
        self.page.evaluate("Object.assign(S.tenants[0],{rentBasis:'mkt',rentPct:.95,rent:1234,sched:[]});DIRTY();drawPane()")
        drawer.get_by_role('button',name='+ Base',exact=True).click()
        self.assertEqual(self.page.evaluate('[S.tenants[0].sched[0].units,S.tenants[0].sched[0].amt]'),['pctmkt',.95])
        monthly=self.page.evaluate('''()=>{const t=S.tenants[0];return resolveSched(t.sched,sSer(t.start),1000,0,'psfyr',0,eSer(t.end),1,()=>30,null)[0].monthly;}''')
        self.assertAlmostEqual(monthly,2375,places=8)  # 95% of $30/SF/year on 1,000 SF / 12.
        schedule=drawer.locator('.basis-lease-section',has=self.page.locator('summary',has_text='Rent Schedule'))
        row=schedule.locator('table tbody tr').first
        row.locator('select').nth(1).select_option('pct')
        amount=row.locator('td').nth(5).locator('input')
        self.assertEqual(amount.get_attribute('type'),'number')
        amount.fill('3');amount.press('Tab')
        self.assertEqual(self.page.evaluate('S.tenants[0].sched[0].amt'),.03)

    def test_property_area_and_market_rent_categories_use_matching_formats(self):
        self.page.evaluate("S.areas[0].sf=123456.789;S.mrents[0].amt=19.125;DIRTY();setMode('inputs');go('property','area')")
        area=self.page.locator('#pane [data-number-format=sf]').first
        expect(area).to_have_value('123,457')
        area.fill('200,000');area.press('Tab')
        self.assertEqual(self.page.evaluate('S.areas[0].sf'),200000)
        self.page.evaluate("go('market','mr')")
        expect(self.page.locator('#pane [data-number-format=psf]').first).to_have_value('$19.13')

    def test_phone_cards_and_editor_show_units_and_keep_decimal_keyboard(self):
        self.seed('yramt',125000.5)
        self.page.set_viewport_size({'width':390,'height':844})
        card=self.page.locator('.basis-tenant-card').first
        expect(card).to_contain_text('12,346 SF');expect(card).to_contain_text('$125,000.50 / Year')
        drawer=self.drawer();rent=drawer.get_by_label('Base Rent',exact=True)
        expect(rent).to_have_attribute('inputmode','decimal')
        rent.fill('130000.75');drawer.get_by_role('button',name='Close Lease Editor',exact=True).click()
        expect(card).to_contain_text('$130,000.75 / Year')
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))


if __name__=='__main__':
    unittest.main()
