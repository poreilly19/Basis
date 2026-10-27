"""Navigation simplicity, theme contrast and portfolio boundaries."""
import unittest
from playwright.sync_api import expect
import browser_test as harness


class UINavigationBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.BrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.BrowserTests.tearDownClass.__func__)
    setUp = harness.BrowserTests.setUp
    tearDown = harness.BrowserTests.tearDown

    def test_numbered_shortcuts_are_removed_and_import_is_discoverable(self):
        self.assertEqual(self.page.locator('.basis-workflow,.basis-route').count(), 0)
        self.page.evaluate("setMode('inputs')")
        expect(self.page.get_by_role('tab', name='Leasing Assumptions', exact=True)).to_be_visible()
        expect(self.page.get_by_role('tab', name='Other Income', exact=True)).to_be_visible()
        self.page.get_by_role('tab', name='Data Workspace', exact=True).click()
        self.page.get_by_role('tab', name='Document Import', exact=True).click()
        expect(self.page.get_by_role('button', name='Configure AI', exact=True)).to_be_visible()
        self.page.get_by_role('button', name='Configure AI', exact=True).click()
        expect(self.page.get_by_label('AI Provider', exact=True)).to_be_visible()
        self.page.get_by_role('dialog', name='Configure AI for Document Import', exact=True).get_by_role('button', name='Cancel', exact=True).click()
        self.page.keyboard.press('Control+k')
        expect(self.page.get_by_role('dialog', name='Jump to workspace', exact=True)).to_be_visible()
        self.page.get_by_label('Search modeling tasks', exact=True).fill('Leasing')
        self.assertGreater(self.page.get_by_role('option').count(), 0)
        self.page.keyboard.press('Escape')

    def test_file_actions_keep_keyboard_focus_during_refresh(self):
        self.page.evaluate("setMode('portfolio')")
        harness.open_library_actions(self.page)
        reload_button = self.page.get_by_role('button', name='Reload library', exact=True)
        reload_button.focus()
        self.page.evaluate('pwPageDraw()')
        expect(reload_button).to_be_visible()
        expect(reload_button).to_be_focused()
        self.page.keyboard.press('Tab')
        expect(self.page.get_by_role('button', name='Recover drafts', exact=True)).to_be_focused()
        self.page.get_by_role('tab', name='File', exact=True).click()
        self.page.evaluate('pwPageDraw()')
        expect(self.page.get_by_role('tab', name='File', exact=True)).to_be_focused()
        expect(reload_button).not_to_be_visible()

    def test_navigation_text_contrast_in_light_and_dark_themes(self):
        self.page.emulate_media(reduced_motion='reduce')
        for theme in ('light', 'dark'):
            for mode in ('portfolio', 'inputs'):
                self.page.evaluate('''({theme,mode})=>{studioSetPreference({theme});setMode(mode);}''', {'theme': theme, 'mode': mode})
                failures = self.page.evaluate('''() => {
                  const rgb=s=>(s.match(/[\\d.]+/g)||[]).map(Number),lum=c=>{const v=c.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return .2126*v[0]+.7152*v[1]+.0722*v[2];};
                  return [...document.querySelectorAll('.basis-command-open,.modeseg button,#nav1 button,#nav2 button,.pwt,.pwx,#basisContextChange,.basis-summary>summary,.studio-tabs button,.deal-choice,.rtabs button,.pftabs button,.ribbon button:not(:disabled)')].filter(b=>b.getBoundingClientRect().width).flatMap(b=>{
                    const fg=rgb(getComputedStyle(b).color);let p=b,bg;
                    while(p){bg=rgb(getComputedStyle(p).backgroundColor);if(bg.length===3||bg[3]>=.99)break;p=p.parentElement;}
                    const x=lum(fg),y=lum(bg||[255,255,255]),ratio=(Math.max(x,y)+.05)/(Math.min(x,y)+.05);
                    return ratio<4.5?[{text:b.textContent.trim(),ratio}]:[];
                  });
                }''')
                self.assertEqual(failures, [], (theme, mode, failures))

    def test_property_picker_and_active_model_stay_with_selected_portfolio(self):
        ids = self.page.evaluate('''async () => {
          const original=PW.cur,first=PW.pf,second=await pwCreatePortfolio('Taunton Portfolio'),scenario=pwPf(second).scs[0].id;
          const other=await pwAdopt({...S,name:'50 John Hancock Road',city:'Taunton'},{quiet:true,pf:second,sc:scenario});
          await pwOpen(other);pwSetPf(first);return {original,first,second,other};
        }''')
        self.assertIn(ids['other'], self.page.evaluate('PW.local.open'))
        self.assertNotIn('50 John Hancock Road', self.page.locator('#pwbar').inner_text())
        expect(self.page.locator('#subttl')).to_have_count(0)
        self.page.get_by_role('button', name='Inputs', exact=True).click()
        expect(self.page.locator('#pane')).to_contain_text('Open a property in the selected portfolio')
        self.assertEqual(self.page.locator('#pane input').count(), 0)
        self.page.get_by_label('Switch property', exact=True).select_option(ids['original'])
        self.page.wait_for_function('(id)=>PW.cur===id', arg=ids['original'])
        self.assertEqual(self.page.evaluate('PW.pf'), ids['first'])
        self.page.evaluate('(id)=>{setMode("portfolio");pwSetPf(id);}', ids['second'])
        self.assertEqual(self.page.locator('#basisPropertyPick option').all_text_contents(), ['Choose a Property', '50 John Hancock Road'])
        self.assertIn(ids['original'], self.page.evaluate('PW.local.open'))

    def test_header_metrics_hide_pending_and_out_of_scope_results_and_resize(self):
        self.page.set_viewport_size({'width':1440,'height':900})
        self.page.evaluate("setMode('inputs');go('tenants','rr')")
        header=self.page.locator('#basisHeaderKpis')
        expect(header).to_be_visible()
        expect(header.locator('.kpi b').first).to_have_text(self.page.evaluate('money(R.noiY1)'))
        self.page.evaluate('S.tenants[0].rent+=1;DIRTY();clearTimeout(tmr)')
        expect(header).not_to_be_visible()
        self.page.evaluate('recalc();renderKPI();drawPane()')
        expect(header).to_be_visible()
        expect(header.locator('.kpi b').first).to_have_text(self.page.evaluate('money(R.noiY1)'))
        self.page.set_viewport_size({'width':390,'height':844})
        expect(header).not_to_be_visible()
        self.page.locator('#basisSummary>summary').click()
        expect(self.page.locator('#kpis')).to_be_visible()
        self.page.keyboard.press('Escape')
        self.page.set_viewport_size({'width':1440,'height':900})
        expect(header).to_be_visible()
        self.page.evaluate("async()=>{const id=await pwCreatePortfolio('Empty Metrics Portfolio');pwSetPf(id);}")
        expect(header).not_to_be_visible()
        expect(self.page.locator('#pane')).to_contain_text('Choose a Property')

    def test_workspace_navigator_and_grid_keep_scenario_and_portfolio_boundaries(self):
        ids=self.page.evaluate('''async()=>{
          const pf=PW.pf,base=PW.sc,first=PW.cur;
          const down=await pwCreateScenario(pf,base,'Downside',false);
          const downside=await pwAdopt({...S,name:'Downside Only'},{quiet:true,pf,sc:down});
          const other=await pwCreatePortfolio('Taunton Portfolio');
          const taunton=await pwAdopt({...S,name:'Taunton Only'},{quiet:true,pf:other,sc:pwPf(other).scs[0].id});
          setMode('portfolio');drawPane();return {pf,base,first,down,downside,other,taunton};
        }''')
        grid=self.page.get_by_role('table',name='Properties in Selected Portfolio and Scenario')
        self.assertEqual(grid.locator('[data-library-property]').count(),1)
        self.page.get_by_label('Active scenario',exact=True).select_option(ids['down'])
        expect(grid).to_contain_text('Downside Only')
        expect(grid).not_to_contain_text('Taunton Only')
        nav=self.page.get_by_role('complementary',name='Portfolio Navigator')
        self.assertEqual(nav.locator('[data-navigator-property]').all_text_contents(),['Downside Only'])
        nav.get_by_role('button',name='Downside Only',exact=True).click()
        self.page.wait_for_function('(id)=>PW.cur===id&&MODE==="inputs"',arg=ids['downside'])
        self.page.evaluate("setMode('portfolio')")
        nav.locator('.deal-choice').filter(has_text='Taunton Portfolio').click()
        expect(grid).to_contain_text('Taunton Only')
        expect(grid).not_to_contain_text('Downside Only')
        self.assertEqual(nav.locator('[data-navigator-property]').all_text_contents(),['Taunton Only'])
        collapse=self.page.get_by_role('button',name='Collapse Portfolio Navigator',exact=True)
        collapse.click();self.page.evaluate('drawPane()')
        expect(nav.locator('.pfcard').first).not_to_be_visible()
        self.page.get_by_role('button',name='Expand Portfolio Navigator',exact=True).click()
        expect(nav.locator('.pfcard').first).to_be_visible()

    def test_property_grid_inclusion_recovers_failed_write_and_saves_success(self):
        name=self.page.evaluate('S.name');pid=self.page.evaluate('PW.cur')
        include=self.page.get_by_label('Include '+name+' in the roll-up',exact=True)
        self.page.evaluate("()=>{window.savedCommit=pwCommit;pwCommit=async()=>{throw Error('Injected storage failure')};}")
        include.click()
        expect(self.page.locator('.kdlg')).to_contain_text('Injected storage failure')
        expect(include).to_be_checked()
        self.assertTrue(self.page.evaluate('(id)=>pwRec(id).inc',pid))
        self.page.evaluate('()=>{pwCommit=window.savedCommit;}')
        self.page.locator('.kdlg').get_by_role('button',name='OK',exact=True).click()
        include.uncheck()
        self.page.wait_for_function('(id)=>pwRec(id).inc===false',arg=pid)
        expect(self.page.locator('.studio-metrics')).to_contain_text('0 included')
        self.page.reload();self.page.evaluate('PW.ready')
        expect(include).not_to_be_checked()
        include.check();self.page.wait_for_function('(id)=>pwRec(id).inc===true',arg=pid)
        expect(self.page.locator('.studio-metrics')).to_contain_text('1 included')

    def test_property_grid_search_selection_and_phone_open_preserve_inputs(self):
        ids=self.page.evaluate('''async()=>{const original=PW.cur,second=await pwAdopt({...S,name:'Second Property'},{quiet:true});setMode('portfolio');drawPane();return {original,second};}''')
        self.page.get_by_label('Search properties',exact=True).fill('Second Property')
        expect(self.page.locator('.basis-property-grid tbody .pwrow')).to_have_count(1)
        self.page.get_by_label('Check Second Property',exact=True).check()
        expect(self.page.get_by_role('button',name='Duplicate Records',exact=True)).to_be_visible()
        self.assertEqual(self.page.evaluate('[...PW.sel]'),[ids['second']])
        self.page.get_by_role('button',name='Select None',exact=True).click()
        before=self.page.evaluate('JSON.stringify(S)')
        for width in (390,320):
            self.page.set_viewport_size({'width':width,'height':844})
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
            self.assertEqual(self.page.evaluate('JSON.stringify(S)'),before)
        button=self.page.locator('.pwgrid .pwlink').filter(has_text='Second Property')
        button.focus();self.page.keyboard.press('Enter')
        self.page.wait_for_function('(id)=>PW.cur===id&&MODE==="inputs"',arg=ids['second'])
        expect(self.page.get_by_label('Property Name',exact=True)).to_have_value('Second Property')


if __name__ == '__main__':
    unittest.main()
