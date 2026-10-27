"""Reference ribbon parity and corrected workspace action integration (offline)."""
import unittest
from playwright.sync_api import expect
import browser_test as harness


class RibbonBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.BrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.BrowserTests.tearDownClass.__func__)
    setUp = harness.BrowserTests.setUp
    tearDown = harness.BrowserTests.tearDown

    def ribbon(self):
        return self.page.locator('.ribbon')

    def test_reference_button_order_groups_and_left_navigator(self):
        # Arrangement from the supplied HTML, SHA 8a63732e...ddf3e, with neutral workbook labels.
        expected = {
            'Home': [('New', ['New Portfolio', 'New Property', 'New Scenario']),
                     ('Property', ['Open Property', 'Duplicate Records', 'Copy To…', 'Move To…', 'Delete Records']),
                     ('Selection', ['Select All', 'Select None']),
                     ('Portfolio', ['Rename Portfolio', 'Delete Portfolio', 'Rename Scenario', 'Delete Scenario']),
                     ('Data', ['Import', 'Export']), ('Calculate', ['Calculate']),
                     ('Reports', ['Combined Cash Flow', 'Portfolio Value'])],
            'View': [('Show / Hide', ['Hide Navigator', 'Show Classifications']),
                     ('Arrange', ['Clear search and grouping']), ('Window', ['Light / Dark'])],
            'Reports': [('Portfolio Reports', ['Combined Cash Flow', 'Portfolio Value', 'Property List']),
                        ('Property Reports', ['Open in Reports', 'Report Workbook'])]
        }
        self.page.set_viewport_size({'width': 1440, 'height': 900})
        self.assertEqual(self.page.locator('.rtabs button').all_text_contents(), ['File', 'Home', 'View', 'Reports'])
        self.assertEqual(self.page.locator('#modeSeg button').all_text_contents(), ['Portfolio', 'Inputs', 'Reports'])
        for tab, groups in expected.items():
            self.page.locator('.rtabs').get_by_role('tab', name=tab, exact=True).click()
            actual = self.ribbon().locator('.rgrp').evaluate_all(r'''groups => groups.map(g=>[g.getAttribute('aria-label'), [...g.querySelectorAll('button')].map(b=>b.textContent.replace(/\s+/g,' ').trim())])''')
            self.assertEqual(actual, [[group, buttons] for group, buttons in groups])
            self.assertEqual(self.ribbon().locator('button svg').count(), self.ribbon().locator('button').count())
        nav = self.page.locator('.pfnav').bounding_box()
        main = self.page.locator('.pfmain').bounding_box()
        ribbon = self.ribbon().bounding_box()
        self.assertEqual(nav['x'], 0)
        self.assertEqual(nav['width'], 250)
        self.assertGreaterEqual(main['x'], nav['x'] + nav['width'])
        self.assertGreaterEqual(nav['y'], ribbon['y'] + ribbon['height'])

    def test_selection_buttons_duplicate_and_open_corrected_models(self):
        ribbon = self.ribbon()
        expect(ribbon.get_by_role('button', name='Open Property', exact=True)).to_be_disabled()
        expect(ribbon.get_by_role('button', name='Duplicate Records', exact=True)).to_be_disabled()
        original = self.page.evaluate('JSON.stringify(S)')
        ribbon.get_by_role('button', name='Select All', exact=True).click()
        expect(ribbon.get_by_role('button', name='Open Property', exact=True)).to_be_enabled()
        ribbon.get_by_role('button', name='Duplicate Records', exact=True).click()
        self.page.wait_for_function('pwList().length===2')
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'), original)
        ribbon.get_by_role('button', name='Select All', exact=True).click()
        expect(ribbon.get_by_role('button', name='Open Property', exact=True)).to_be_disabled()
        ribbon.get_by_role('button', name='Select None', exact=True).click()
        target = self.page.evaluate('pwList().find(p=>p.id!==PW.cur)')
        self.page.get_by_label('Check ' + target['name'], exact=True).check()
        ribbon.get_by_role('button', name='Open Property', exact=True).click()
        self.page.wait_for_function('(id)=>PW.cur===id&&MODE==="inputs"', arg=target['id'])
        self.assertEqual(self.page.evaluate('S.name'), target['name'])

    def test_menu_keyboard_focus_file_import_and_document_route(self):
        imp = self.ribbon().get_by_role('button', name='Import', exact=True)
        imp.click()
        menu = self.page.get_by_role('menu', name='Import', exact=True)
        expect(menu.get_by_role('menuitem').first).to_be_focused()
        self.page.keyboard.press('End')
        expect(menu.get_by_role('menuitem').last).to_be_focused()
        self.page.keyboard.press('ArrowDown')
        expect(menu.get_by_role('menuitem').first).to_be_focused()
        self.page.keyboard.press('Escape')
        expect(imp).to_be_focused()
        expect(menu).to_have_count(0)
        imp.click()
        self.page.evaluate('pwPageDraw()')
        expect(menu).to_have_count(0)
        expect(imp).to_be_focused()
        imp.click()
        menu.get_by_role('menuitem', name='Documents: OM, rent roll, leases…', exact=True).click()
        expect(self.page.get_by_role('button', name='Configure AI', exact=True)).to_be_visible()
        expect(self.page.get_by_role('tab', name='Document Import', exact=True)).to_have_attribute('aria-selected', 'true')
        imp.click()
        menu.get_by_role('menuitem', name='Workbook template or report package…', exact=True).click()
        self.assertEqual(self.page.evaluate('[MODE,T1,T2]'), ['inputs', 'tools', 'workbook'])
        expect(self.page.get_by_role('tab', name='Workbook Import / Export', exact=True)).to_have_attribute('aria-selected', 'true')
        self.page.locator('#modeSeg').get_by_role('button', name='Portfolio', exact=True).click()
        self.ribbon().get_by_role('button', name='Export', exact=True).click()
        self.page.get_by_role('menuitem', name='Input workbook template of the open property…', exact=True).click()
        self.assertEqual(self.page.evaluate('[MODE,T1,T2]'), ['inputs', 'tools', 'workbook'])
        expect(self.page.locator('#pane')).to_contain_text('Workbook export')

    def test_view_grouping_sort_classifications_and_navigator(self):
        self.page.evaluate("async()=>{await pwAdopt({...S,name:'Zeta',city:'Taunton'},{quiet:true});S.name='Alpha';S.city='Peabody';DIRTY();await pwSaveCur();setMode('portfolio');drawPane()}")
        self.page.get_by_role('button', name='City', exact=True).click()
        names = self.page.locator('.pwgrid tbody .pwrow .pwlink').all_text_contents()
        self.assertEqual(names, ['Alpha', 'Zeta'])
        self.page.locator('.rtabs').get_by_role('tab', name='View', exact=True).click()
        self.ribbon().get_by_label('Group by', exact=True).select_option('city')
        expect(self.page.locator('.pwgrid')).to_contain_text('City: Peabody (1)')
        expect(self.page.locator('.pwgrid')).to_contain_text('City: Taunton (1)')
        self.ribbon().get_by_role('button', name='Show Classifications', exact=True).click()
        expect(self.page.locator('.pwgrid thead')).to_contain_text('Asset Manager')
        self.ribbon().get_by_role('button', name='Hide Navigator', exact=True).click()
        expect(self.page.locator('.pfnav')).to_have_class('pfnav basis-library-navigator min is-collapsed')
        self.ribbon().get_by_role('button', name='Show Navigator', exact=True).click()
        expect(self.page.locator('.pfnav .pfcard')).to_have_count(1)
        self.page.get_by_label('Search properties', exact=True).fill('Zeta')
        self.ribbon().get_by_role('button', name='Clear search and grouping', exact=True).click()
        self.assertEqual(self.page.evaluate('[PW.find,PW.group]'), ['', ''])
        expect(self.page.locator('.pwgrid tbody .pwrow')).to_have_count(2)

    def test_file_options_and_settings_preserve_session_credentials(self):
        harness.open_library_actions(self.page)
        self.page.get_by_role('button', name='Options', exact=True).click()
        expect(self.page.get_by_label('Autosave While Editing', exact=True)).to_be_visible()
        self.page.get_by_label('AI Provider', exact=True).select_option('openai')
        self.page.get_by_label('API Key', exact=True).fill('test-session-draft')
        self.page.locator('.rtabs').get_by_role('tab', name='View', exact=True).click()
        expect(self.page.get_by_label('API Key', exact=True)).to_have_value('test-session-draft')
        self.page.evaluate('pwPageDraw()')
        expect(self.page.get_by_label('API Key', exact=True)).to_have_value('test-session-draft')
        self.assertFalse(self.page.evaluate("JSON.stringify(localStorage).includes('test-session-draft')"))

    def test_report_actions_reject_out_of_scope_and_failed_open(self):
        original = self.page.evaluate('PW.cur')
        other = self.page.evaluate("async()=>{const id=await pwCreatePortfolio('Other Portfolio');pwSetPf(id);return id}")
        self.page.locator('.rtabs').get_by_role('tab', name='Reports', exact=True).click()
        expect(self.ribbon().get_by_role('button', name='Open in Reports', exact=True)).to_be_disabled()
        expect(self.ribbon().get_by_role('button', name='Report Workbook', exact=True)).to_be_disabled()
        self.page.locator('.rtabs').get_by_role('tab', name='Home', exact=True).click()
        self.ribbon().get_by_role('button', name='Export', exact=True).click()
        expect(self.page.get_by_role('menuitem', name='Property file of the open property…', exact=True)).to_be_disabled()
        expect(self.page.get_by_role('menuitem', name='Input workbook template of the open property…', exact=True)).to_be_disabled()
        self.page.keyboard.press('Escape')
        target = self.page.evaluate("async()=>{const id=await pwAdopt({...S,name:'Unavailable Report'},{quiet:true});PW.sel.add(id);PWV.tab='reports';drawPane();window.originalOpen=pwOpen;pwOpen=async()=>{};return id}")
        self.ribbon().get_by_role('button', name='Open in Reports', exact=True).click()
        self.assertEqual(self.page.evaluate('[MODE,PW.cur,PW.pf]'), ['portfolio', original, other])
        self.page.evaluate('()=>{pwOpen=window.originalOpen;}')
        self.ribbon().get_by_role('button', name='Open in Reports', exact=True).click()
        self.page.wait_for_function('(id)=>PW.cur===id&&MODE==="reports"', arg=target)

    def test_calculate_failure_and_report_formats_are_explicit(self):
        before = self.page.evaluate('JSON.stringify(PW.ix)')
        self.page.evaluate("()=>{window.savedCommit=pwCommit;pwCommit=async()=>{throw Error('Calculation save blocked')};}")
        self.ribbon().get_by_role('button', name='Calculate', exact=True).click()
        expect(self.page.locator('.kdlg')).to_contain_text('Calculation save blocked')
        self.assertEqual(self.page.evaluate('JSON.stringify(PW.ix)'), before)
        self.page.locator('.kdlg').get_by_role('button', name='OK', exact=True).click()
        self.page.evaluate('()=>{pwCommit=window.savedCommit;}')
        self.page.locator('.rtabs').get_by_role('tab', name='Reports', exact=True).click()
        self.ribbon().get_by_role('button', name='Report Workbook', exact=True).click()
        expect(self.page.get_by_role('button', name='Export report tables (.json)', exact=True)).to_be_visible()
        self.assertEqual(self.page.evaluate('[MODE,T1,T2]'), ['inputs', 'tools', 'dump'])


if __name__ == '__main__':
    unittest.main()
