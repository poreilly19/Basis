"""Lease drawer, bulk classification and document review with offline AI fixtures."""
import unittest
from playwright.sync_api import expect
import browser_test as harness


class WorkflowBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.BrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.BrowserTests.tearDownClass.__func__)
    setUp = harness.BrowserTests.setUp
    tearDown = harness.BrowserTests.tearDown

    def tenants(self):
        self.page.evaluate('''() => {
          S.tgroups=[{id:'a',name:'Industrial'},{id:'b',name:'Credit'}];
          S.tenants=S.tenants.slice(0,2);
          Object.assign(S.tenants[0],{name:'Alpha',suite:'100',group:'a'});
          Object.assign(S.tenants[1],{name:'Beta',suite:'200',group:''});
          for(const t of S.tenants)delete t.groups;
          DIRTY();setMode('inputs');go('tenants','rr');
        }''')
        self.page.wait_for_function('!!R && !calcPending')

    def drawer(self):
        self.page.get_by_role('button', name='Edit lease for Alpha', exact=True).click()
        return self.page.get_by_role('dialog', name='Lease Editor for Alpha', exact=True)

    def seed_import(self):
        self.page.evaluate('''() => {
          S.city='Current City';S.tenants[0].name='Alpha';S.tenants[0].suite='100';S.tenants[0].sf=1000;S.tenants[0].rent=10;
          INT.docs=[{id:'doc',name:'Lease Fixture',kind:'Text',on:true,status:'ready',
            pages:[{n:1,text:'Annual rent is $12,000.'}],images:[],results:[],err:'',warn:''}];
          _intLim={maxPromptBytes:150000};_sample={json:async()=>({
            docType:'lease',property:{city:'Proposed City'},
            tenants:[{name:'Alpha',suite:'100',sf:1000,start:'2026-01-01',end:'2030-12-31',
              rent:[{from:'2026-01-01',amount:12000,unit:'annual'}],src:{page:1,quote:'Annual rent is $12,000.'}}]
          })};getSample=async()=>_sample;setMode('inputs');go('tools','import');
        }''')

    def test_drawer_edits_conditional_terms_and_preserves_background_scroll(self):
        self.tenants()
        before = self.page.evaluate('JSON.stringify(S)')
        drawer = self.drawer()
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'), before, 'Opening an editor must not change model data')
        expect(drawer.get_by_label('Tenant Name', exact=True)).to_have_value('Alpha')
        self.assertEqual(self.page.locator('#pane .basis-lease-drawer').count(), 0)
        self.page.evaluate("document.querySelector('#pane .scroll').scrollLeft=80")
        scroll = self.page.evaluate("document.querySelector('#pane .scroll').scrollLeft")
        drawer.get_by_label('Suite', exact=True).fill('101')
        drawer.locator('summary', has_text='Lease Details').click()
        drawer.get_by_label('Term entered as', exact=True).select_option('term')
        expect(drawer.get_by_label('Term years', exact=True)).to_be_visible()
        drawer.get_by_label('Term years', exact=True).fill('7')
        drawer.get_by_label('Term months', exact=True).fill('2')
        drawer.get_by_label('Upon Expiration', exact=True).select_option('Option')
        drawer.locator('summary', has_text='Option Terms').click()
        expect(drawer.get_by_label('Option term years', exact=True)).to_be_visible()
        drawer.get_by_role('button', name='Close Lease Editor', exact=True).click()
        self.page.evaluate('recalcInBackground()')
        self.assertEqual(self.page.evaluate('[S.tenants[0].suite,S.tenants[0].termYears,S.tenants[0].termMonths,S.tenants[0].expiry]'), ['101', 7, 2, 'Option'])
        self.assertEqual(self.page.evaluate("document.querySelector('#pane .scroll').scrollLeft"), scroll)
        expect(self.page.get_by_role('button', name='Edit lease for Alpha', exact=True)).to_be_focused()
        self.page.evaluate('pwSaveCur()')
        self.page.reload(); self.page.evaluate('PW.ready')
        self.assertEqual(self.page.evaluate('S.tenants[0].suite'), '101')

    def test_drawer_keeps_uncommitted_text_during_calculation_and_closes_on_property_change(self):
        self.tenants(); drawer = self.drawer()
        name = drawer.get_by_label('Tenant Name', exact=True)
        name.fill('Uncommitted Name')
        self.page.evaluate('recalcInBackground()')
        expect(name).to_have_value('Uncommitted Name'); expect(name).to_be_focused()
        self.assertEqual(self.page.evaluate('S.tenants[0].name'), 'Alpha')
        self.page.evaluate('window.previousDrawerTenant=S.tenants[0]')
        other = self.page.evaluate("pwAdopt({...blankState(),name:'Other Property'},{quiet:true})")
        self.page.evaluate('pwOpen', other)
        expect(self.page.locator('.basis-lease-drawer')).to_have_count(0)
        self.assertEqual(self.page.evaluate('S.name'), 'Other Property')
        self.assertEqual(self.page.evaluate('S.tenants.length'), 0)
        self.assertEqual(self.page.evaluate('previousDrawerTenant.name'), 'Alpha')

    def test_mobile_drawer_contains_fields_and_schedule_dialogs_remain_usable(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.tenants(); drawer = self.drawer()
        rect = drawer.bounding_box()
        self.assertGreaterEqual(rect['x'], 0); self.assertLessEqual(rect['x']+rect['width'], 390)
        date = drawer.get_by_label('Commencement, exact day', exact=True).bounding_box()
        self.assertGreater(date['width'], 105, 'A complete date remains usable in compact Lease Basics')
        drawer.locator('summary', has_text='Rent Schedule').click()
        drawer.get_by_role('button', name='+ Base', exact=True).click()
        self.assertEqual(self.page.evaluate('S.tenants[0].sched.length'), 1)
        drawer.get_by_role('button', name='Clear', exact=True).click()
        self.page.get_by_role('alertdialog').get_by_role('button', name='Clear', exact=True).click()
        self.assertEqual(self.page.evaluate('S.tenants[0].sched'), [])
        drawer.get_by_role('button', name='Close Lease Editor', exact=True).focus()
        self.page.keyboard.press('Escape')
        expect(drawer).to_have_count(0)

    def test_bulk_groups_filter_chips_and_undo_preserve_other_memberships(self):
        self.tenants(); self.page.evaluate("go('tenants','tg');histCommit();histReset()")
        expect(self.page.get_by_role('button', name='Add Group', exact=True)).not_to_be_visible()
        self.page.get_by_label('Select All Visible Tenants', exact=True).check()
        self.page.get_by_label('Bulk Group', exact=True).select_option('b')
        self.page.get_by_role('button', name='Add Group', exact=True).click()
        dialog = self.page.get_by_role('dialog', name='Review Bulk Group Change', exact=True)
        expect(dialog).to_contain_text('2 selected tenants')
        dialog.get_by_role('button', name='Apply to Selected Tenants', exact=True).click()
        self.assertEqual(self.page.evaluate('S.tenants.map(t=>basisTenantGroupIds(t))'), [['a','b'],['b']])
        expect(self.page.get_by_role('button', name='Groups for Alpha', exact=True).locator('.tenant-group-chip')).to_have_text(['Industrial','Credit'])
        self.page.get_by_label('Filter by Tenant Group', exact=True).select_option('group:a')
        expect(self.page.get_by_label('Select Alpha', exact=True)).to_be_visible()
        expect(self.page.get_by_label('Select Beta', exact=True)).to_have_count(0)
        self.page.get_by_label('Select All Visible Tenants', exact=True).check()
        self.page.get_by_label('Bulk Group', exact=True).select_option('b')
        self.page.get_by_role('button', name='Remove Group', exact=True).click()
        self.page.get_by_role('button', name='Apply to Selected Tenants', exact=True).click()
        self.assertEqual(self.page.evaluate('S.tenants.map(t=>basisTenantGroupIds(t))'), [['a'],['b']])
        self.page.keyboard.press('Control+z')
        self.page.wait_for_function("basisTenantGroupIds(S.tenants[0]).includes('b')")

    def test_filter_changes_clear_hidden_selection_and_bulk_changes_reject_stale_memberships(self):
        self.tenants(); self.page.evaluate("go('tenants','tg')")
        self.page.get_by_label('Select Alpha', exact=True).check()
        self.page.get_by_label('Search Tenants', exact=True).fill('Beta')
        expect(self.page.get_by_role('button', name='Add Group', exact=True)).not_to_be_visible()
        self.page.get_by_label('Select Beta', exact=True).check()
        self.page.get_by_label('Bulk Group', exact=True).select_option('b')
        self.page.get_by_role('button', name='Add Group', exact=True).click()
        self.page.evaluate("basisSetTenantGroups(S.tenants[1],['a'])")
        self.page.get_by_role('button', name='Apply to Selected Tenants', exact=True).click()
        expect(self.page.get_by_role('dialog').get_by_role('alert')).to_contain_text('memberships changed')
        self.assertEqual(self.page.evaluate('S.tenants[1].groups'), ['a'])
        self.page.get_by_role('button', name='Cancel', exact=True).click()

    def test_rent_roll_group_filter_does_not_change_totals_or_cross_properties(self):
        self.tenants()
        original = self.page.evaluate('JSON.stringify(calc(S).noiY1)')
        self.page.get_by_label('Filter by Tenant Group', exact=True).select_option('group:a')
        expect(self.page.get_by_role('button', name='Edit lease for Alpha', exact=True)).to_be_visible()
        expect(self.page.get_by_role('button', name='Edit lease for Beta', exact=True)).to_have_count(0)
        self.assertEqual(self.page.evaluate('JSON.stringify(calc(S).noiY1)'), original)
        self.page.evaluate("S.tgroups.push({id:'__ungrouped',name:'Imported Group'});basisSetTenantGroups(S.tenants[1],['__ungrouped']);drawPane()")
        self.page.get_by_label('Filter by Tenant Group', exact=True).select_option('group:__ungrouped')
        expect(self.page.get_by_role('button', name='Edit lease for Beta', exact=True)).to_be_visible()
        expect(self.page.get_by_role('button', name='Edit lease for Alpha', exact=True)).to_have_count(0)
        self.page.get_by_label('Filter by Tenant Group', exact=True).select_option('ungrouped')
        expect(self.page.get_by_role('button', name='Edit lease for Beta', exact=True)).to_have_count(0)
        other = self.page.evaluate("pwAdopt({...blankState(),name:'Other'},{quiet:true})")
        self.page.evaluate('pwOpen', other)
        expect(self.page.get_by_label('Filter by Tenant Group', exact=True)).to_have_value('all')
        expect(self.page.get_by_label('Search Tenants', exact=True)).to_have_value('')

    def test_inline_ai_setup_keeps_documents_and_sends_nothing_until_extraction(self):
        self.page.evaluate("studioOpenDocumentImport();INT.paste='Unsent document';drawPane()")
        self.page.get_by_role('button', name='Configure AI', exact=True).click()
        dialog = self.page.get_by_role('dialog', name='Configure AI for Document Import', exact=True)
        dialog.get_by_label('AI Provider', exact=True).select_option('openai')
        dialog.get_by_label('API Key', exact=True).fill('fixture-only-key')
        self.page.evaluate("() => {window.aiCalls=0;window.fetch=async()=>{aiCalls++;throw Error('Unexpected network call')};}")
        dialog.get_by_role('button', name='Use AI Setup', exact=True).click()
        self.assertEqual(self.page.evaluate('[PWV.sub,INT.paste,aiCalls,basisAIStatus().configured]'), ['import','Unsent document',0,True])
        self.assertFalse(self.page.evaluate("[JSON.stringify(S),JSON.stringify(INT),JSON.stringify(localStorage),JSON.stringify(sessionStorage)].some(x=>x.includes('fixture-only-key'))"))
        expect(self.page.get_by_role('button', name='AI Setup', exact=True)).to_be_visible()

    def test_drawer_controls_have_readable_contrast_in_both_themes(self):
        self.tenants(); self.drawer(); self.page.emulate_media(reduced_motion='reduce')
        for theme in ('light','dark'):
            self.page.evaluate('theme=>studioSetPreference({theme})', theme)
            failures=self.page.evaluate('''() => {
              const rgb=s=>(s.match(/[\\d.]+/g)||[]).map(Number),lum=c=>{const v=c.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return .2126*v[0]+.7152*v[1]+.0722*v[2]};
              return [...document.querySelectorAll('.basis-lease-drawer button,.basis-lease-drawer input,.basis-lease-drawer select')].filter(n=>n.getClientRects().length&&getComputedStyle(n).opacity!=='0').flatMap(n=>{
                const fg=rgb(getComputedStyle(n).color);let parent=n,bg;
                while(parent){bg=rgb(getComputedStyle(parent).backgroundColor);if(bg.length===3||bg[3]>=.99)break;parent=parent.parentElement;}
                const a=lum(fg),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);return ratio<4.5?[{text:n.textContent,ratio}]:[];
              });
            }''')
            self.assertEqual(failures,[],theme)

    def test_review_shows_actual_current_proposed_and_source_before_apply(self):
        self.seed_import()
        expect(self.page.locator('.basis-intake-steps [aria-current=step]')).to_have_text('1. Upload')
        before = self.page.evaluate('JSON.stringify(S)')
        self.page.evaluate('intExtract()')
        expect(self.page.locator('.basis-intake-steps [aria-current=step]')).to_have_text('2. Review')
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'), before, 'Preview must not change the model')
        review = self.page.get_by_role('region', name='Selected Changes', exact=True)
        row = review.locator('tbody tr').filter(has=self.page.locator('td', has_text='Tenant · Alpha · Base Rent'))
        expect(row.locator('td').nth(1)).to_have_text('$10.00 /SF/year')
        expect(row.locator('td').nth(2)).to_have_text('$12.00 /SF/year')
        expect(row.locator('td').nth(3)).to_contain_text('Annual rent is $12,000.')
        self.page.get_by_label('Include prop:city', exact=True).uncheck()
        expect(review).not_to_contain_text('Proposed City')
        self.page.get_by_role('button', name='Apply selected', exact=True).click()
        self.page.wait_for_function('!INT.applying && !!INT.applied')
        expect(self.page.locator('.basis-intake-steps [aria-current=step]')).to_have_text('3. Apply')
        self.assertEqual(self.page.evaluate('[S.city,S.tenants[0].rent]'), ['Current City',12])
        self.assertTrue(self.page.evaluate("S.srcLog.some(x=>x.quote==='Annual rent is $12,000.')"))

    def test_empty_selection_cannot_apply_and_copy_preview_explains_removed_rows(self):
        self.seed_import(); self.page.evaluate('intExtract()')
        self.page.get_by_role('radio', name='Create a new property with these tenants and expenses', exact=True).check()
        expect(self.page.get_by_role('region', name='Selected Changes', exact=True)).to_contain_text('original property stays in your library')
        for box in self.page.locator('input[aria-label^="Include "]').all():
            box.uncheck()
        expect(self.page.get_by_role('button', name='Apply selected', exact=True)).to_be_disabled()
        self.assertFalse(self.page.evaluate('intApplySelected()'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
