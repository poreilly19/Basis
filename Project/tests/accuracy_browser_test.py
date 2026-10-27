"""Independent financial/report and document-mapping regressions, with no live AI."""
import unittest
from playwright.sync_api import expect
import browser_test as harness
import workflow_browser_test as workflow


class AccuracyBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.BrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.BrowserTests.tearDownClass.__func__)
    setUp = harness.BrowserTests.setUp
    tearDown = harness.BrowserTests.tearDown
    seed_import = workflow.WorkflowBrowserTests.seed_import

    def flat(self):
        self.page.evaluate('''() => {
          S=blankState();Object.assign(S,{startYear:2026,startMonth:1,years:2,gvRate:0,clRate:0,
            priceMode:'amount',price:120000,exitCap:.08,costSale:0,discount:.1,pvMode:'nominal',loanOn:false});
          S.infl.forEach(x=>x.rates=[0,0,0,0]);S.areas[0].sf=1000;
          S.tenants=[{id:'tenant',name:'Tenant',suite:'100',sf:1000,start:'2026-01-01',end:'2035-12-31',
            rent:12,rentBasis:'psfyr',step:0,free:0,rec:S.recs[1].id,mla:S.mlas[0].id,expiry:'Vacate'}];
          S.ops=[{id:'cost',name:'Operating costs',amt:2400,basis:'amt',fixedPct:1,infl:0,recov:false}];
          DIRTY();
        }''')

    def test_worker_gross_up_matches_independent_low_occupancy_example(self):
        self.flat()
        values = self.page.evaluate('''async () => {
          S.tenants[0].sf=50;S.tenants[0].rec=S.recs[0].id;
          Object.assign(S.recs[0],{grossUp:.95,adminFee:0});Object.assign(S.ops[0],{amt:10000,fixedPct:.2,recov:true});
          DIRTY();await recalcInBackground();return [R.ann.op[0],R.ann.reimb[0],R.ann.noi[0]];
        }''')
        for actual, expected in zip(values, [2400,480,-1320]):
            self.assertAlmostEqual(actual, expected, places=7)

    def test_draw_only_loan_returns_remain_visible_in_reports_and_native_roundtrip(self):
        self.flat()
        result = self.page.evaluate('''async () => {
          S.loanOn=true;S.loans=[{id:'loan',name:'Future facility',sizing:'amount',amount:0,rateType:'fixed',rate:.06,
            ioAll:true,ffMax:1000,ffPct:1}];S.caps=[{id:'project',name:'July project',amt:1000,basis:'amt',year:1,timing:'Jul',infl:0}];
          DIRTY();await recalcInBackground();setMode('reports');go('val','vrs');
          const bytes=await basisCreateArchive({kind:'property',model:S}),restored=await basisReadArchive(new Blob([bytes]));
          const again=calc(restored.model);
          return {equity:R.equity,multiple:R.mult,irr:R.irrL,again:again.irrL,
            matrix:RB.irrmx(S,R).blocks.some(b=>b.title==='Leveraged IRR'),
            holds:RB.rot(S,R).blocks[0].rows.some(r=>r.c[0]==='Leveraged IRR')};
        }''')
        self.assertEqual(result['equity'],120000)
        self.assertAlmostEqual(result['multiple'],138110/120000,places=10)
        self.assertEqual(result['irr'],result['again'])
        self.assertTrue(result['matrix'] and result['holds'],result)
        expect(self.page.locator('#pane')).to_contain_text('Leveraged IRR')

    def test_present_value_rows_reconcile_to_totals_with_day_adjustment(self):
        self.flat()
        results = self.page.evaluate('''() => {
          Object.assign(S,{valDays:true,valDate:'2026-01-16'});const checks=[];
          for(const pvMode of ['annual','nominal','effective'])for(const interval of ['annual','quarterly','monthly']){
            S.pvMode=pvMode;const result=calc(S);RO.int=interval;
            const rows=RB.pv(S,result).blocks[0].rows,stop=rows.findIndex(r=>r.c[0]==='Total cash flow');
            for(let col=2;col<rows[stop].c.length;col++)checks.push({pvMode,interval,
              sum:rows.slice(0,stop).reduce((total,row)=>total+row.c[col],0),total:rows[stop].c[col]});
          }
          return checks;
        }''')
        for case in results:
            self.assertAlmostEqual(case['sum'],case['total'],places=6,msg=str(case))

    def test_import_review_applies_the_document_expiry_and_later_free_rent(self):
        self.flat();self.seed_import()
        self.page.evaluate('''async () => {
          Object.assign(S.tenants[0],{termMode:'term',termYears:1,termMonths:0,free:2,freeStart:4,freeBasis:'market'});
          const response=await _sample.json();response.tenants[0].end='2028-12-31';
          response.tenants[0].freeRent={months:1,start:'2026-07-01'};_sample.json=async()=>response;
          await intExtract();
        }''')
        review=self.page.get_by_role('region',name='Review Tenant Fields')
        expect(review.get_by_label('Decision for Free Rent Terms',exact=True)).to_be_visible()
        expect(review.locator('[data-review-field="abatement"]')).to_contain_text('Proposed: 7')
        self.page.get_by_role('button',name='Apply selected',exact=True).click()
        self.page.wait_for_function('!INT.applying && !!INT.applied')
        values=self.page.evaluate('''() => {const result=calc(S);return {end:leaseEnd(S.tenants[0]),
          january:result.monthly.sched[0],july:result.monthly.sched[6],year2:result.ann.sched[1]};}''')
        self.assertEqual(values['end'],'2028-12-31')
        for key,expected in [('january',1000),('july',0),('year2',12000)]:
            self.assertAlmostEqual(values[key],expected,places=7)

    def test_import_review_can_keep_free_rent_terms_and_correct_expiry_mode(self):
        self.flat();self.seed_import()
        self.page.evaluate('''async () => {
          Object.assign(S.tenants[0],{termMode:'term',termYears:1,termMonths:0,free:2,freeStart:4,freeBasis:'months'});
          const response=await _sample.json();response.tenants[0].freeRent={months:1,start:'2026-07-01'};
          _sample.json=async()=>response;await intExtract();
        }''')
        review=self.page.get_by_role('region',name='Review Tenant Fields')
        review.get_by_label('Decision for Free Rent Terms',exact=True).select_option('keep')
        review.get_by_label('Decision for Expiry',exact=True).select_option('edit')
        review.get_by_label('Correct Expiry Entry',exact=True).select_option('term')
        self.page.get_by_role('button',name='Apply selected',exact=True).click()
        self.page.wait_for_function('!INT.applying && !!INT.applied')
        self.assertEqual(self.page.evaluate('[S.tenants[0].free,S.tenants[0].freeStart,S.tenants[0].freeBasis,leaseEnd(S.tenants[0])]'),[2,4,'months','2026-12-31'])


    def report_credit_fixture(self):
        self.flat()
        self.page.evaluate('''async () => {
          S.ops.push({id:'credit',name:'Expense Credit',amt:-120,basis:'amt',fixedPct:1,infl:0},
            {id:'ref-op',name:'Reference Op',amt:9000,basis:'amt',fixedPct:1,infl:0,refOnly:true});
          S.nonops=[{id:'non',name:'Nonop Cost',amt:600,basis:'amt',infl:0},
            {id:'ref-non',name:'Reference Nonop',amt:6000,basis:'amt',infl:0,refOnly:true}];
          S.caps=[{id:'cap',name:'Capital Project',amt:1200,basis:'amt',infl:0},
            {id:'ref-cap',name:'Reference Cap',amt:3000,basis:'amt',infl:0,refOnly:true}];
          S.groundLeases=[{id:'op',rent:240,rentBasis:'amt',start:'2026-01',termYears:10,treatment:'op'},
            {id:'non',rent:120,rentBasis:'amt',start:'2026-01',termYears:10,treatment:'nonop'}];
          Object.assign(S.tenants[0],{tiBasis:'amt',tiAmt:600,lcBasis:'amt',lcAmt:360,incBasis:'amt',incAmt:240,
            sdOn:true,sdBasis:'amt',sdAmt:1200});
          S.loanOn=true;S.loans=[{id:'io',name:'Interest Only',sizing:'amount',amount:60000,rateType:'fixed',rate:.06,ioAll:true,feePct:0},
            {id:'bridge',name:'Six Month Facility',sizing:'amount',amount:1000,rateType:'fixed',rate:0,ioAll:true,start:'2026-07',termMonths:6,feePct:.01,ffMax:500,ffPct:1}];
          DIRTY();await recalcInBackground();cfView='annual';cfUnits='1';RO.int='annual';RO.unit='$';setMode('reports');go('prop','cf');
        }''')

    def test_cash_flow_screen_keeps_credits_and_actual_monthly_ground_rent(self):
        self.report_credit_fixture()
        def table_rows():
            return self.page.locator('#pane table.cf tbody tr').evaluate_all("rows=>rows.map(row=>[...row.cells].map(cell=>cell.textContent))")
        annual = table_rows()
        self.assertFalse(any(row[0].startswith('Reference ') for row in annual))
        lookup = {row[0]: row[1:] for row in annual}
        self.assertEqual(lookup['Expense Credit'], ['120', '120'])
        self.assertEqual(lookup['Total operating expenses'], ['(2,520)', '(2,520)'])
        self.assertEqual(lookup['NET OPERATING INCOME'], ['9,480', '9,480'])
        self.assertEqual(lookup['CASH FLOW BEFORE DEBT SERVICE'], ['7,560', '6,360'])
        self.assertEqual(lookup['CASH FLOW AFTER DEBT SERVICE'], ['3,950', '2,760'])
        self.page.locator('#pane select').filter(has=self.page.locator('option[value="monthly"]')).select_option('monthly')
        monthly = table_rows()
        self.assertFalse(any(row[0].startswith('Reference ') for row in monthly))
        ground = [row for row in monthly if row[0] == 'Ground rent']
        self.assertEqual(len(ground), 2)
        self.assertEqual(ground[0][1:], ['(20)'] * 24)
        self.assertEqual(ground[1][1:], ['(10)'] * 24)
        credit = next(row for row in monthly if row[0] == 'Expense Credit')
        self.assertEqual(credit[1:], ['10'] * 24)

    def test_as_of_cash_flow_and_csv_preserve_credit_signs_and_exclude_reference_costs(self):
        import csv
        import io
        from pathlib import Path
        self.report_credit_fixture()
        result = self.page.evaluate('''()=>{
          const result=[];
          for(const int of ['annual','quarterly','monthly'])for(const unit of ['$','psf']){
            RO.int=int;RO.unit=unit;const table=RB.cfasof(S,R).blocks[0];
            result.push({int,unit,rows:table.rows.map(row=>row.c)});
          }
          RO.int='annual';RO.unit='$';go('prop','cfasof');return result;
        }''')
        for table in result:
            rows = {row[0]: row[1:] for row in table['rows']}
            self.assertNotIn('Reference Op', rows)
            factor = {'annual': 1, 'quarterly': 4, 'monthly': 12}[table['int']]
            if table['unit'] == 'psf':
                factor *= 1000
            for amount in rows['Expense Credit']:
                self.assertAlmostEqual(amount, 120 / factor, places=7)
            for amount in rows['Total operating expenses']:
                self.assertAlmostEqual(amount, -2520 / factor, places=7)
        screen_row = self.page.locator('#pane tr').filter(has=self.page.get_by_text('Expense Credit', exact=True))
        expect(screen_row).to_contain_text('120')
        self.assertNotIn('(', screen_row.inner_text())
        with self.page.expect_download() as pending:
            self.page.get_by_role('button', name='Export CSV', exact=True).click()
        file = Path(self.tmp.name) / 'as-of.csv';pending.value.save_as(file)
        rows = {row[0].strip(): row[1:] for row in csv.reader(io.StringIO(file.read_text(encoding="utf-8-sig"))) if row}
        self.assertNotIn('Reference Op', rows)
        self.assertEqual([float(x) for x in rows['Expense Credit']], [120,120])
        self.assertEqual([float(x) for x in rows['Total operating expenses']], [-2520,-2520])

    def test_cash_flow_csv_details_reconcile_incentives_deposits_and_financing(self):
        import csv
        import io
        from pathlib import Path
        self.report_credit_fixture()
        self.page.evaluate("async()=>{S.ops.find(x=>x.id==='credit').amt=-120.125;DIRTY();await recalcInBackground();}")
        with self.page.expect_download() as pending:
            self.page.get_by_role('button', name='Export CSV', exact=True).click()
        file = Path(self.tmp.name) / 'cash-flow.csv';pending.value.save_as(file)
        rows = {row[0].strip(): [float(x) for x in row[1:]] for row in list(csv.reader(io.StringIO(file.read_text(encoding="utf-8-sig"))))[1:]}
        for name in ['Reference Op','Reference Nonop','Reference Cap']:
            self.assertNotIn(name, rows)
        expected = {'Expense Credit':[120.125,120.125], 'Ground rent':[-240,-240],
            'Ground rent — Non-operating':[-120,-120], 'Tenant incentives':[-240,0],
            'Security deposits, received less refunded':[1200,-1200],
            'Loan proceeds, net of fees':[990,0], 'Future funding draws':[500,0], 'Loan repaid at maturity':[-1500,0],
            'CASH FLOW BEFORE DEBT SERVICE':[7560.125,6360.125], 'CASH FLOW AFTER DEBT SERVICE':[3950.125,2760.125]}
        for name, values in expected.items():
            for actual, expected_amount in zip(rows[name], values):
                self.assertAlmostEqual(actual, expected_amount, places=7, msg=name)
        for y in [0,1]:
            self.assertAlmostEqual(rows['Total operating expenses'][y], sum(rows[name][y] for name in ['Operating costs','Expense Credit','Ground rent']), places=7)
            self.assertAlmostEqual(rows['Total non-operating expenses'][y], rows['Nonop Cost'][y]+rows['Ground rent — Non-operating'][y], places=7)
            self.assertAlmostEqual(rows['Total leasing & capital costs'][y], sum(rows[name][y] for name in ['Tenant improvements','Leasing commissions','Tenant incentives','Capital Project']), places=7)
            self.assertAlmostEqual(rows['CASH FLOW BEFORE DEBT SERVICE'][y], sum(rows[name][y] for name in ['NET OPERATING INCOME','Total non-operating expenses','Total leasing & capital costs','Security deposits, received less refunded']), places=7)
            self.assertAlmostEqual(rows['CASH FLOW AFTER DEBT SERVICE'][y], sum(rows[name][y] for name in ['CASH FLOW BEFORE DEBT SERVICE','Debt service','Loan proceeds, net of fees','Future funding draws','Loan repaid at maturity']), places=7)

    def test_executive_summary_preserves_a_net_expense_credit(self):
        self.flat()
        amounts = self.page.evaluate('''async()=>{
          S.ops=[{id:'credit',name:'Tax Refund',amt:-1200,basis:'amt',fixedPct:1,infl:0}];
          DIRTY();await recalcInBackground();RO.int='annual';setMode('reports');go('prop','exec');
          const rows=RB.exec(S,R).blocks.find(b=>b.title.startsWith('Cash flow summary')).rows;
          return Object.fromEntries(rows.map(row=>[row.c[0],row.c.slice(1)]));
        }''')
        self.assertEqual(amounts['Operating expenses'], [1200,1200])
        self.assertEqual(amounts['Net operating income'], [13200,13200])
        screen_row = self.page.locator('#pane tr').filter(has=self.page.get_by_text('Operating expenses', exact=True))
        expect(screen_row).to_contain_text('1,200')
        self.assertNotIn('(', screen_row.inner_text())

    def test_summary_and_portfolio_reports_reconcile_net_credits_incentives_and_deposits(self):
        self.flat()
        reports = self.page.evaluate('''async()=>{
          S.ops=[{id:'credit',name:'Tax Refund',amt:-1200,basis:'amt',fixedPct:1,infl:0}];
          S.nonops=[{id:'non-credit',name:'Nonop Refund',amt:-600,basis:'amt',infl:0}];
          Object.assign(S.tenants[0],{incBasis:'amt',incAmt:120,sdOn:true,sdBasis:'amt',sdAmt:1200});
          DIRTY();await recalcInBackground();RO.int='annual';
          return Object.fromEntries(['exec','rot','yearly','resale'].map(key=>[key,RB[key](S,R).blocks.filter(b=>b.t==='table').flatMap(b=>b.rows.map(row=>row.c))]));
        }''')
        for name in ['exec','rot','yearly']:
            rows = {row[0]: row[1:] for row in reports[name]}
            for actual, expected in zip(rows['Cash flow before debt'], [14880,12600]):
                self.assertAlmostEqual(actual, expected, places=7, msg=name)
            self.assertEqual(rows['Non-operating expenses'], [600,600], name)
            self.assertEqual(rows['Security deposits, received less refunded'], [1200,-1200], name)
            label = 'Leasing costs' if name == 'exec' else 'Leasing and capital costs'
            self.assertEqual(rows[label], [-120,0], name)
            for y in [0,1]:
                self.assertAlmostEqual(rows['Cash flow before debt'][y], rows['Net operating income'][y]+rows['Non-operating expenses'][y]+rows[label][y]+rows['Security deposits, received less refunded'][y], places=7)
        resale = {row[0]: row[1:] for row in reports['resale']}
        self.assertEqual(resale['Operating expenses, year 3'], [1200])
        self.page.evaluate('''async()=>{
          Object.assign(S.tenants[0],{prOn:true,prRate:.1,prSales:12000,prSalesBasis:'amt',prBreakType:'amt',prBreak:0});
          DIRTY();await recalcInBackground();await pwSaveCur();PWV.sub='cf';setMode('portfolio');drawPane();
        }''')
        table = self.page.locator('#pfpage table.cf tbody tr').evaluate_all("rows=>rows.map(row=>[...row.cells].map(cell=>cell.textContent))")
        rows = {row[0]: row[1:] for row in table}
        self.assertEqual(rows['Percentage rent'], ['1,200','1,200'])
        self.assertEqual(rows['Total operating expenses'], ['1,200','1,200'])
        self.assertEqual(rows['Non-operating expenses'], ['600','600'])
        self.assertEqual(rows['Security deposits, received less refunded'], ['1,200','(1,200)'])
        self.assertEqual(rows['CASH FLOW BEFORE DEBT SERVICE'], ['16,080','13,800'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
