"""Multiple tenant groups, persistence, reports and restored local downloads."""
from pathlib import Path
import unittest
from playwright.sync_api import expect
import browser_test as harness


class TenantGroupsBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.BrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.BrowserTests.tearDownClass.__func__)
    tearDown = harness.BrowserTests.tearDown
    archive = harness.BrowserTests.archive
    read_archive = harness.BrowserTests.read_archive
    upload = harness.BrowserTests.upload

    def setUp(self):
        harness.BrowserTests.setUp(self)
        self.page.evaluate('''() => {
          S.tgroups=[{id:'a',name:'Industrial'},{id:'b',name:'Credit'},{id:'c',name:'Renewal Watch'}];
          S.tenants=S.tenants.slice(0,2);
          Object.assign(S.tenants[0],{name:'Alpha',sf:100,group:'a'});
          Object.assign(S.tenants[1],{name:'Beta',sf:200,group:'b'});
          for(const t of S.tenants)delete t.groups;
          DIRTY();setMode('inputs');go('tenants','tg');
        }''')

    def picker(self, name='Alpha'):
        return self.page.get_by_role('button', name='Groups for '+name, exact=True)

    def open_groups(self):
        self.picker().click()
        return self.page.get_by_role('dialog', name='Tenant Groups for Alpha', exact=True)

    def assign_two(self):
        dialog = self.open_groups()
        dialog.get_by_role('checkbox', name='Credit', exact=True).check()
        dialog.get_by_role('button', name='Apply Groups', exact=True).click()

    def test_cancel_search_apply_and_clear_keep_legacy_memberships(self):
        original = self.page.evaluate('JSON.stringify(S.tenants[0])')
        dialog = self.open_groups()
        expect(dialog.get_by_role('checkbox', name='Industrial', exact=True)).to_be_checked()
        dialog.get_by_role('checkbox', name='Credit', exact=True).check()
        dialog.get_by_role('button', name='Cancel', exact=True).click()
        self.assertEqual(self.page.evaluate('JSON.stringify(S.tenants[0])'), original)
        expect(self.picker()).to_be_focused()
        dialog = self.open_groups()
        search = dialog.get_by_label('Search tenant groups', exact=True)
        search.fill('Credit')
        dialog.get_by_role('checkbox', name='Credit', exact=True).check()
        expect(dialog.get_by_role('status')).to_have_text('2 groups selected')
        search.fill('no matching group')
        expect(dialog).to_contain_text('No matching groups')
        dialog.get_by_role('button', name='Apply Groups', exact=True).click()
        expect(self.picker().locator('.tenant-group-chip')).to_have_text(['Industrial', 'Credit'])
        expect(self.picker()).to_be_focused()
        self.assertEqual(self.page.evaluate('S.tenants[0].groups'), ['a', 'b'])
        dialog = self.open_groups()
        dialog.get_by_role('checkbox', name='Industrial', exact=True).uncheck()
        dialog.get_by_role('checkbox', name='Credit', exact=True).uncheck()
        dialog.get_by_role('button', name='Apply Groups', exact=True).click()
        self.assertEqual(self.page.evaluate('[S.tenants[0].group,S.tenants[0].groups]'), ['', []])
        expect(self.picker()).to_have_text('Assign Groups')

    def test_group_area_deletion_and_undo_preserve_other_assignments(self):
        self.assign_two()
        rows = self.page.locator('#pane table').first.locator('tbody tr')
        expect(rows.nth(0).locator('td').nth(2)).to_have_text('100')
        expect(rows.nth(1).locator('td').nth(2)).to_have_text('300')
        expect(rows.nth(1).locator('td').nth(1)).to_have_text('Alpha, Beta')
        self.page.evaluate('histCommit();histReset()')
        rows.first.get_by_title('Delete (Ctrl+Delete)', exact=True).click()
        self.page.get_by_role('alertdialog').get_by_role('button', name='Delete', exact=True).click()
        self.assertEqual(self.page.evaluate('[S.tenants[0].groups,S.tenants[0].group,S.tenants[1].group]'), [['b'], 'b', 'b'])
        self.page.keyboard.press('Control+z')
        self.page.wait_for_function("S.tgroups.some(g=>g.id==='a')")
        self.assertEqual(self.page.evaluate('S.tenants[0].groups'), ['a', 'b'])

    def test_rent_roll_essentials_and_classifications_open_the_same_editor(self):
        self.page.evaluate("go('tenants','rr')")
        self.page.get_by_role('button', name='Edit lease for Alpha', exact=True).click()
        self.page.locator('.basis-lease-drawer summary',has_text='Lease Details').click()
        self.assign_two()
        self.page.get_by_role('button', name='Close Lease Editor', exact=True).click()
        self.page.get_by_label('Rent Roll View', exact=True).select_option('Tenant Classifications')
        expect(self.picker()).to_be_visible()
        expect(self.picker().locator('.tenant-group-chip')).to_have_text(['Industrial', 'Credit'])
        self.page.get_by_label('Rent Roll View', exact=True).select_option('All')
        expect(self.picker().locator('.tenant-group-chip')).to_have_text(['Industrial', 'Credit'])

    def test_save_reload_property_switch_and_native_roundtrip(self):
        self.assign_two()
        original = self.page.evaluate('PW.cur')
        other = self.page.evaluate("pwAdopt({...blankState(),name:'Other property'})")
        self.page.evaluate('pwOpen', original)
        self.assertEqual(self.page.evaluate('S.tenants[0].groups'), ['a', 'b'])
        self.page.evaluate('pwOpen', other)
        self.assertEqual(self.page.evaluate('S.tenants'), [])
        self.page.evaluate('pwOpen', original)
        self.page.evaluate('pwSaveCur()')
        self.page.reload()
        self.page.evaluate('PW.ready')
        self.assertEqual(self.page.evaluate('S.tenants[0].groups'), ['a', 'b'])
        self.page.evaluate("setMode('inputs');go('tools','file')")
        with self.page.expect_download() as download:
            self.page.get_by_role('button', name='Export / Backup', exact=True).click()
            self.page.get_by_role('dialog', name='Export and Backup', exact=True).get_by_role('button', name='Download', exact=True).click()
        file = Path(self.tmp.name) / 'groups.basiscre'
        download.value.save_as(file)
        self.assertEqual(self.read_archive(file)['model']['tenants'][0]['groups'], ['a', 'b'])
        self.upload(file)
        self.page.wait_for_function('PW.ix.props.length===3')
        self.assertEqual(self.page.evaluate('S.tenants[0].groups'), ['a', 'b'])

    def test_scenario_copy_and_contract_renewal_have_independent_memberships(self):
        self.assign_two()
        ids = self.page.evaluate('''async () => {
          const original=PW.cur;
          const scenario=await pwCreateScenario(PW.pf,PW.sc,'Alternate',true);
          const copy=PW.ix.props.find(p=>p.sc===scenario).id;
          await pwOpen(copy);basisSetTenantGroups(S.tenants[0],['b']);DIRTY();
          await pwOpen(original);return {original,copy};
        }''')
        self.assertEqual(self.page.evaluate('S.tenants[0].groups'), ['a', 'b'])
        result = self.page.evaluate('''() => {
          const t=S.tenants[0];addContractRenewal(t);const renewal=S.tenants.find(x=>x.crOf===t.id);
          const before=[...renewal.groups],independent=renewal.groups!==t.groups;
          basisSetTenantGroups(renewal,['c']);return {before,independent,original:t.groups,renewal:renewal.groups};
        }''')
        self.assertEqual(result, {'before': ['a', 'b'], 'independent': True, 'original': ['a', 'b'], 'renewal': ['c']})
        self.page.evaluate('pwOpen', ids['copy'])
        self.assertEqual(self.page.evaluate('S.tenants[0].groups'), ['b'])

    def test_stale_model_and_membership_changes_cannot_be_overwritten(self):
        for change in ("S=JSON.parse(JSON.stringify(S))", "basisSetTenantGroups(S.tenants[0],['c'])", "S.tgroups=S.tgroups.filter(g=>g.id!=='b')"):
            self.page.evaluate("S.tgroups=[{id:'a',name:'Industrial'},{id:'b',name:'Credit'},{id:'c',name:'Renewal Watch'}];basisSetTenantGroups(S.tenants[0],['a']);drawPane()")
            dialog = self.open_groups()
            dialog.get_by_role('checkbox', name='Credit', exact=True).check()
            self.page.evaluate(change)
            before = self.page.evaluate('JSON.stringify(S)')
            dialog.get_by_role('button', name='Apply Groups', exact=True).click()
            expect(dialog.get_by_role('alert')).to_be_visible()
            self.assertEqual(self.page.evaluate('JSON.stringify(S)'), before)
            dialog.get_by_role('button', name='Cancel', exact=True).click()

    def test_keyboard_mobile_theme_and_unresolved_group_names(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.evaluate("studioSetPreference({theme:'dark'});S.tgroups[1].name='<img src=x onerror=alert(1)>';basisSetTenantGroups(S.tenants[0],['a','missing']);drawPane()")
        dialog = self.open_groups()
        expect(dialog.get_by_label('Search tenant groups', exact=True)).to_be_focused()
        expect(dialog.get_by_role('checkbox', name='Missing Group: missing', exact=True)).to_be_checked()
        expect(dialog.get_by_role('checkbox', name='<img src=x onerror=alert(1)>', exact=True)).to_be_visible()
        self.assertEqual(dialog.locator('img').count(), 0)
        bounds = dialog.bounding_box()
        self.assertGreaterEqual(bounds['x'], 0)
        self.assertLessEqual(bounds['x']+bounds['width'], 390)
        self.assertGreaterEqual(bounds['y'], 0)
        self.assertLessEqual(bounds['y']+bounds['height'], 844)
        dialog.get_by_role('button', name='Apply Groups', exact=True).focus()
        self.page.keyboard.press('Tab')
        self.assertTrue(self.page.evaluate('document.activeElement.closest("dialog")!==null'))
        self.page.keyboard.press('Escape')
        expect(dialog).to_have_count(0)
        expect(self.picker()).to_be_focused()
        self.assertEqual(self.page.evaluate('S.tenants[0].groups'), ['a', 'missing'])

    def test_reports_show_groups_and_xl4adw_discloses_unsupported_classifications(self):
        self.assign_two()
        result = self.page.evaluate('''() => {
          R=calc(S);const rep=RB.tensum(S,R),table=rep.blocks.find(b=>b.t==='table');
          const exported=x4Build(S),sheets=Object.fromEntries(Object.entries(exported.rows).map(([name,records])=>{
            const cols=[...new Set(records.flatMap(r=>Object.keys(r)))];
            return [name,{adw:true,cols,rows:records.map(r=>cols.map(c=>r[c]??null))}];
          }));
          return {headers:table.cols.map(c=>c.h),row:table.rows.find(row=>row.c[0].startsWith('Alpha')).c,
            notes:exported.notes,importWarnings:x4Import({sheets}).warnings};
        }''')
        self.assertEqual(result['headers'][-1], 'Tenant Groups')
        self.assertEqual(result['row'][-1], 'Industrial; Credit')
        self.assertTrue(any('Tenant group classifications are not exported' in note for note in result['notes']))
        self.assertTrue(any('Tenant group classifications from XL4ADW are not imported' in note for note in result['importWarnings']))
        self.page.get_by_role('tab', name='Data Workspace', exact=True).click()
        self.page.get_by_role('tab', name='ARGUS / XL4ADW', exact=True).click()
        expect(self.page.locator('#pane')).to_contain_text('ARGUS import')

    def test_source_log_csv_downloads_without_host_service(self):
        self.page.evaluate("S.srcLog=[{at:'2026-10-21',target:'Tenant',value:'=1+1',doc:'lease.pdf',page:'2',quote:'Original source'}];go('tools','import')")
        with self.page.expect_download() as download:
            self.page.get_by_role('button', name='Download CSV', exact=True).click()
        file = Path(self.tmp.name) / 'source-log.csv'
        download.value.save_as(file)
        self.assertEqual(download.value.suggested_filename, 'basis-source-log.csv')
        self.assertIn("'=1+1", file.read_text())
        self.assertIn('Original source', file.read_text())


if __name__ == '__main__':
    unittest.main()
