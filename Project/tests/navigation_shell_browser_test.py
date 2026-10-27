"""Responsive navigation, scoped context, summaries and phone rent-roll workflows."""
import unittest
from playwright.sync_api import expect
import browser_test as harness


class NavigationShellBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.BrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.BrowserTests.tearDownClass.__func__)
    setUp = harness.BrowserTests.setUp
    tearDown = harness.BrowserTests.tearDown

    def rent_roll(self):
        self.page.emulate_media(reduced_motion='reduce')
        self.page.evaluate("setMode('inputs');go('tenants','rr')")

    def test_horizontal_tabs_retain_every_model_and_report_destination(self):
        self.page.set_viewport_size({'width':1440,'height':1000})
        for mode, variable in [('inputs', 'NAV'), ('reports', 'RNAV')]:
            self.page.evaluate('(mode)=>setMode(mode)', mode)
            groups = self.page.evaluate(variable + '.map(g=>({id:g.id,pages:g.subs.map(([id])=>id)}))')
            self.assertEqual(self.page.locator('#nav1 [role="tab"]').count(),len(groups))
            for group in groups:
                section=self.page.locator('#nav1 [data-section="'+group['id']+'"]')
                section.click()
                expect(section).to_have_attribute('aria-selected','true')
                self.assertEqual(self.page.locator('#nav2 [role="tab"]').count(),len(group['pages']))
                for page in group['pages']:
                    with self.subTest(mode=mode,group=group['id'],page=page):
                        tab=self.page.locator('#nav2 [data-page="'+page+'"]');tab.click()
                        expect(tab).to_have_attribute('aria-selected','true')
                        self.assertEqual(self.page.evaluate('[MODE,T1,T2]'),[mode,group['id'],page])
                        self.assertNotIn('This pane failed to render',self.page.locator('#pane').inner_text())
        expect(self.page.locator('#basisSidebar')).not_to_be_visible()
        self.assertEqual(self.page.locator('#nav1').count(),1)
        self.assertEqual(self.page.locator('#nav2').count(),1)
        self.assertGreater(self.page.locator('#pane').bounding_box()['width'],1400)

    def test_tab_keyboard_activation_preserves_model_and_focus_through_refresh(self):
        self.rent_roll();before=self.page.evaluate('JSON.stringify(S)')
        current=self.page.locator('#nav1 [data-section="tenants"]');current.focus()
        self.page.keyboard.press('ArrowLeft')
        first=self.page.locator('#nav1 [data-section="property"]');expect(first).to_be_focused()
        expect(current).to_have_attribute('aria-selected','true')
        self.assertEqual(self.page.evaluate('[T1,T2]'),['tenants','rr'])
        self.page.keyboard.press('Enter');expect(first).to_have_attribute('aria-selected','true')
        self.assertEqual(self.page.evaluate('[T1,T2]'),['property','desc'])
        last=self.page.locator('#nav2 [role="tab"]').last
        self.page.locator('#nav2 [role="tab"]').first.focus();self.page.keyboard.press('End')
        expect(last).to_be_focused();self.page.keyboard.press('Enter')
        expect(last).to_have_attribute('aria-selected','true')
        self.page.evaluate('drawPane()');expect(last).to_be_focused()
        self.page.keyboard.press('Home');expect(self.page.locator('#nav2 [role="tab"]').first).to_be_focused()
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'),before)

    def test_phone_shows_property_first_tenant_and_action_without_header_scrolling(self):
        for width in (390, 320, 640):
            with self.subTest(width=width):
                self.page.set_viewport_size({'width': width, 'height': 844})
                self.rent_roll()
                self.page.evaluate('scrollTo(0,0)')
                expect(self.page.locator('#modeSeg')).not_to_be_visible()
                expect(self.page.locator('#studioDock')).to_be_visible()
                expect(self.page.locator('#kpis')).not_to_be_visible()
                expect(self.page.get_by_label('Switch property', exact=True)).to_be_in_viewport()
                card = self.page.locator('.basis-tenant-card').first
                action = card.get_by_role('button', name='Edit lease', exact=False)
                bounds, dock = action.bounding_box(), self.page.locator('#studioDock').bounding_box()
                self.assertGreaterEqual(bounds['y'], 0)
                self.assertLess(bounds['y'] + bounds['height'], dock['y'])
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width)
                expect(card.locator('h2')).to_be_in_viewport()
                self.page.get_by_label('Rent Roll Layout', exact=True).select_option('table')
                expect(self.page.get_by_label('Rent Roll View', exact=True)).to_be_visible()
                self.page.get_by_label('Rent Roll Layout', exact=True).select_option('cards')

    def test_mobile_sections_close_with_escape_select_route_and_resize_safely(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.rent_roll()
        opener = self.page.get_by_role('button', name='Sections', exact=True)
        opener.click()
        dialog = self.page.get_by_role('dialog', name='Workspace Sections', exact=True)
        expect(dialog).to_be_visible()
        expect(dialog.locator('[aria-current="page"]')).to_be_focused()
        self.page.keyboard.press('Escape')
        expect(dialog).not_to_be_visible()
        expect(opener).to_be_focused()
        opener.click()
        dialog.get_by_role('button', name='Recoveries', exact=True).click()
        expect(dialog).not_to_be_visible()
        expect(self.page.locator('#basisLocation')).to_be_focused()
        self.assertEqual(self.page.evaluate('[T1,T2]'), ['tenants', 'recov'])
        opener.click()
        self.page.set_viewport_size({'width': 1280, 'height': 800})
        expect(dialog).not_to_be_visible()
        expect(self.page.locator('#nav1')).to_be_visible()
        expect(self.page.locator('#nav2 [aria-selected="true"]')).to_have_text('Recoveries')
        expect(self.page.locator('#basisSidebar')).not_to_be_visible()
        expect(self.page.locator('#nav1 [aria-selected="true"]')).to_be_focused()
        self.assertFalse(self.page.evaluate('!!document.querySelector("dialog:modal")'))

    def test_summary_tracks_current_inputs_and_never_shows_pending_results(self):
        self.rent_roll()
        summary = self.page.locator('#basisSummary')
        summary.locator('summary').click()
        expect(summary.get_by_role('region', name='Property Summary', exact=True)).to_be_visible()
        self.assertEqual(self.page.locator('#basisSummaryProperty').inner_text(), self.page.evaluate('S.name'))
        self.assertIn(self.page.evaluate('money(R.noiY1)'), self.page.locator('#kpis').inner_text())
        self.page.evaluate('S.tenants[0].rent+=1;DIRTY();clearTimeout(tmr)')
        expect(self.page.locator('#kpis')).not_to_be_visible()
        expect(self.page.locator('#basisSummaryHint')).to_have_text('Calculating the current model…')
        self.page.evaluate('recalc();renderKPI();drawPane()')
        self.assertTrue(summary.evaluate('node=>node.open'))
        self.assertIn(self.page.evaluate('money(R.noiY1)'), self.page.locator('#kpis').inner_text())
        self.page.evaluate('R.sf=0;renderKPI()')
        self.assertNotIn('Infinity', summary.inner_text())
        self.page.keyboard.press('Escape')
        expect(summary.locator('summary')).to_be_focused()
        self.assertFalse(summary.evaluate('node=>node.open'))

    def test_context_dialog_scopes_both_scenario_and_portfolio_and_hides_old_results(self):
        ids = self.page.evaluate('''async()=>{
          const pf=PW.pf,sc=PW.sc,original=PW.cur;
          const secondSc=await pwCreateScenario(pf,sc,'Downside',false);
          const scenarioProperty=await pwAdopt({...S,name:'Downside Only'},{quiet:true,pf,sc:secondSc});
          const otherPf=await pwCreatePortfolio('Taunton Portfolio'),otherSc=pwPf(otherPf).scs[0].id;
          const otherProperty=await pwAdopt({...S,name:'50 John Hancock Road'},{quiet:true,pf:otherPf,sc:otherSc});
          return {pf,sc,original,secondSc,scenarioProperty,otherPf,otherSc,otherProperty};
        }''')
        self.rent_roll()
        change = self.page.get_by_role('button', name='Change Portfolio or Scenario', exact=True)
        change.click()
        dialog = self.page.get_by_role('dialog', name='Change Portfolio or Scenario', exact=True)
        dialog.get_by_label('Scenario', exact=True).select_option(ids['secondSc'])
        dialog.get_by_role('button', name='Use Selection', exact=True).click()
        expect(self.page.get_by_label('Switch property', exact=True)).to_have_value('')
        self.assertEqual(self.page.locator('#basisPropertyPick option').all_text_contents(), ['Choose a Property', 'Downside Only'])
        expect(self.page.locator('#pane')).to_contain_text('Choose a Property')
        self.page.locator('#basisSummary>summary').click()
        expect(self.page.locator('#basisSummaryProperty')).to_have_text('Choose a Property')
        expect(self.page.locator('#kpis')).not_to_be_visible()
        self.page.get_by_label('Switch property', exact=True).select_option(ids['scenarioProperty'])
        self.page.wait_for_function('(id)=>PW.cur===id', arg=ids['scenarioProperty'])
        change.click()
        dialog.get_by_label('Portfolio', exact=True).select_option(ids['otherPf'])
        expect(dialog.get_by_label('Scenario', exact=True)).to_have_value(ids['otherSc'])
        dialog.get_by_role('button', name='Use Selection', exact=True).click()
        self.assertEqual(self.page.locator('#basisPropertyPick option').all_text_contents(), ['Choose a Property', '50 John Hancock Road'])
        self.assertNotIn('Downside Only', self.page.locator('#pwbar').inner_text())
        self.assertEqual(self.page.locator('#subttl').count(), 0)

    def test_property_switch_saves_edit_and_keeps_actual_name_during_load(self):
        ids = self.page.evaluate('''async()=>{
          const original=PW.cur,other=await pwAdopt({...S,name:'Second Property'},{quiet:true});
          studioSetPreference({autosave:false});setMode('inputs');go('property','desc');
          const read=pwLoadJson;pwLoadJson=async id=>{if(id===other)await new Promise(resolve=>window.finishPropertyRead=resolve);return read(id);};
          return {original,other};
        }''')
        self.page.get_by_label('Property Name', exact=True).fill('Edited Original')
        self.page.get_by_label('Property Name', exact=True).press('Tab')
        pick = self.page.get_by_label('Switch property', exact=True)
        pick.select_option(ids['other'])
        self.page.wait_for_function('typeof window.finishPropertyRead==="function"')
        expect(pick).to_have_value(ids['original'])
        self.page.evaluate('window.finishPropertyRead()')
        self.page.wait_for_function('(id)=>PW.cur===id', arg=ids['other'])
        expect(pick).to_have_value(ids['other'])
        stored = self.page.evaluate('(id)=>pwGetModel(id).then(row=>JSON.parse(row.json).name)', ids['original'])
        self.assertEqual(stored, 'Edited Original')
        pick.select_option(ids['original'])
        self.page.wait_for_function('(id)=>PW.cur===id', arg=ids['original'])
        expect(self.page.get_by_label('Property Name', exact=True)).to_have_value('Edited Original')

    def test_restored_property_tabs_stay_within_portfolio_and_scenario(self):
        ids=self.page.evaluate('''async()=>{
          const first=PW.cur,pf=PW.pf,sc=PW.sc;
          const second=await pwAdopt({...S,name:'Second Peabody Property'},{quiet:true});
          const down=await pwCreateScenario(pf,sc,'Downside',false);
          const otherScenario=await pwAdopt({...S,name:'Downside Property'},{quiet:true,pf,sc:down});
          const otherPf=await pwCreatePortfolio('Other Portfolio');
          const other=await pwAdopt({...S,name:'Taunton Property'},{quiet:true,pf:otherPf,sc:pwPf(otherPf).scs[0].id});
          PW.local.open=[first,other,otherScenario,second];pwLocalSave();
          setMode('inputs');go('tenants','rr');return {first,second,other,otherScenario};
        }''')
        tabs=self.page.locator('#basisPropertyTabs')
        self.assertEqual(tabs.get_by_role('tab').all_text_contents(),[self.page.evaluate('S.name'),'Second Peabody Property'])
        tabs.get_by_role('tab',name='Second Peabody Property',exact=True).click()
        self.page.wait_for_function('(id)=>PW.cur===id',arg=ids['second'])
        expect(tabs.get_by_role('tab',name='Second Peabody Property')).to_have_attribute('aria-selected','true')
        self.page.evaluate("studioSetPreference({autosave:false});S.notes='Edited before closing';DIRTY()")
        tabs.get_by_role('button',name='Close Second Peabody Property',exact=True).click()
        self.page.wait_for_function('(id)=>PW.cur===id',arg=ids['first'])
        self.assertNotIn(ids['second'],self.page.evaluate('PW.local.open'))
        self.assertIn(ids['other'],self.page.evaluate('PW.local.open'))
        self.assertIn(ids['otherScenario'],self.page.evaluate('PW.local.open'))
        saved=self.page.evaluate('(id)=>pwGetModel(id).then(row=>JSON.parse(row.json).notes)',ids['second'])
        self.assertEqual(saved,'Edited before closing')
        self.assertEqual(self.page.evaluate('PW.ix.props.length'),4)

    def test_last_tab_close_saves_returns_to_workspace_and_model_reopens_it(self):
        self.rent_roll();pid=self.page.evaluate('PW.cur')
        self.page.evaluate("studioSetPreference({autosave:false});S.notes='Last tab edits';DIRTY()")
        self.page.locator('#basisPropertyTabs .pwx').click()
        self.page.wait_for_function('MODE==="portfolio"')
        self.assertNotIn(pid,self.page.evaluate('PW.local.open'))
        expect(self.page.locator('#modePf')).to_be_focused()
        self.assertEqual(self.page.evaluate('(id)=>pwGetModel(id).then(row=>JSON.parse(row.json).notes)',pid),'Last tab edits')
        self.page.locator('#modeIn').click()
        expect(self.page.locator('#basisPropertyTabs [aria-selected="true"]')).to_be_visible()
        self.assertIn(pid,self.page.evaluate('PW.local.open'))
        self.assertEqual(self.page.evaluate('S.notes'),'Last tab edits')

    def test_failed_save_does_not_close_the_tab_or_discard_edits(self):
        self.rent_roll();pid=self.page.evaluate('PW.cur')
        self.page.evaluate("()=>{studioSetPreference({autosave:false});S.notes='Keep me';DIRTY();window.originalCommit=pwCommit;pwCommit=async()=>{throw Error('Injected full disk')}}")
        self.page.locator('#basisPropertyTabs .pwx').click()
        self.page.wait_for_function('PW.status==="Not saved"')
        expect(self.page.locator('#basisPropertyTabs [aria-selected="true"]')).to_be_visible()
        self.assertEqual(self.page.evaluate('[MODE,PW.cur,S.notes]'),['inputs',pid,'Keep me'])
        self.assertIn(pid,self.page.evaluate('PW.local.open'))
        self.page.evaluate('()=>{pwCommit=window.originalCommit;}')

    def test_inactive_close_and_property_arrow_keys_do_not_change_financial_inputs(self):
        ids=self.page.evaluate('''async()=>{const first=PW.cur,second=await pwAdopt({...S,name:'Second Property'},{quiet:true});PW.local.open.push(second);setMode('inputs');go('tenants','rr');return {first,second};}''')
        before=self.page.evaluate('JSON.stringify(S)');tabs=self.page.locator('#basisPropertyTabs')
        tabs.get_by_role('tab').first.focus();self.page.keyboard.press('ArrowRight')
        expect(tabs.get_by_role('tab',name='Second Property')).to_be_focused()
        self.assertEqual(self.page.evaluate('PW.cur'),ids['first'])
        tabs.get_by_role('button',name='Close Second Property').click()
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'),before)
        self.assertEqual(self.page.evaluate('PW.ix.props.length'),2)

    def test_slow_tab_load_cannot_restore_an_old_portfolio_selection(self):
        ids=self.page.evaluate('''async()=>{
          const first=PW.cur,second=await pwAdopt({...S,name:'Slow Property'},{quiet:true}),pf=await pwCreatePortfolio('Another Portfolio');
          PW.local.open.push(second);setMode('inputs');go('tenants','rr');const read=pwLoadJson;
          pwLoadJson=async id=>{if(id===second)await new Promise(resolve=>window.finishTabRead=resolve);return read(id)};return {first,second,pf};
        }''')
        self.page.locator('#basisPropertyTabs').get_by_role('tab',name='Slow Property').click()
        self.page.wait_for_function('typeof window.finishTabRead==="function"')
        self.page.evaluate('(id)=>pwSetPf(id)',ids['pf'])
        self.page.evaluate('window.finishTabRead()');self.page.evaluate('PW.q')
        self.assertEqual(self.page.evaluate('PW.pf'),ids['pf'])
        self.assertEqual(self.page.evaluate('PW.cur'),ids['first'])
        expect(self.page.locator('#pane')).to_contain_text('Choose a Property')
        self.assertNotIn('Slow Property',self.page.locator('#pwbar').inner_text())

    def test_many_open_properties_scroll_inside_the_strip_without_page_overflow(self):
        self.page.evaluate('''async()=>{for(let n=0;n<5;n++){const id=await pwAdopt({...S,name:'Long Property Address '+n+' — Peabody Massachusetts'},{quiet:true});PW.local.open.push(id);}setMode('inputs');go('tenants','rr');}''')
        self.page.set_viewport_size({'width':1024,'height':900})
        tabs=self.page.locator('#basisPropertyTabs');self.assertTrue(tabs.evaluate('node=>node.scrollWidth>node.clientWidth'))
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),1024)
        tabs.get_by_role('tab').first.focus();self.page.keyboard.press('End')
        last=tabs.get_by_role('tab').last;expect(last).to_be_focused()
        self.assertTrue(tabs.evaluate('node=>node.scrollLeft>0'))
        before=self.page.evaluate('JSON.stringify(S)');self.page.evaluate('drawPane()');expect(last).to_be_focused()
        self.assertEqual(self.page.evaluate('JSON.stringify(S)'),before)

    def test_phone_editor_returns_focus_to_card_and_views_do_not_change_model(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.rent_roll()
        before = self.page.evaluate('JSON.stringify(S)')
        card = self.page.locator('.basis-tenant-card').first
        action = card.get_by_role('button')
        action.click()
        drawer = self.page.locator('.basis-lease-drawer')
        self.assertEqual(round(drawer.bounding_box()['width']), 390)
        drawer.get_by_label('Suite', exact=True).fill('New Suite')
        drawer.get_by_role('button', name='Close Lease Editor', exact=True).click()
        expect(action).to_be_focused()
        expect(card).to_contain_text('New Suite')
        self.page.get_by_label('Rent Roll Layout', exact=True).select_option('table')
        self.page.get_by_label('Rent Roll Layout', exact=True).select_option('cards')
        self.assertEqual(self.page.evaluate('S.tenants[0].suite'), 'New Suite')
        restored = self.page.evaluate('(before)=>{const m=JSON.parse(JSON.stringify(S));m.tenants[0].suite=JSON.parse(before).tenants[0].suite;return JSON.stringify(m);}', before)
        self.assertEqual(restored, before)

    def test_hidden_table_selection_cannot_duplicate_or_delete_phone_tenants(self):
        self.rent_roll()
        name = self.page.locator('#pane table.kgrid tbody tr').first.locator('input').first
        name.focus()
        before = self.page.evaluate('JSON.stringify(S.tenants)')
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.evaluate('document.activeElement.blur()')
        self.page.keyboard.press('Control+d')
        self.page.keyboard.press('Control+Delete')
        self.assertEqual(self.page.evaluate('JSON.stringify(S.tenants)'), before)
        expect(self.page.locator('.kdlg-ov')).to_have_count(0)
        self.page.get_by_label('Rent Roll Layout', exact=True).select_option('table')
        name.focus()
        count = self.page.evaluate('S.tenants.length')
        self.page.keyboard.press('Control+d')
        self.assertEqual(self.page.evaluate('S.tenants.length'), count + 1)


if __name__ == '__main__':
    unittest.main()
