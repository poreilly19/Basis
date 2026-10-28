"""Optional real SheetJS checks against separately cached, hash-pinned bytes."""
import unittest
from urllib.parse import urlsplit

import browser_test as harness
from runtime_dependency_support import load_runtime_dependencies

XLSX_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'


def populated_inputs(value):
    # Legacy tables normalize blank cells to null and add empty record lists.
    # Compare all populated inputs exactly, including numeric zero and false.
    if isinstance(value, list):
        return [populated_inputs(item) for item in value]
    if isinstance(value, dict):
        result = {key: populated_inputs(item) for key, item in value.items()}
        return {key: item for key, item in result.items()
                if item is not None and item != '' and item != [] and item != {}}
    return value


class RuntimeXlsxSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.artifacts = load_runtime_dependencies()
        harness.BrowserTests.setUpClass.__func__(cls)

    @classmethod
    def tearDownClass(cls):
        harness.BrowserTests.tearDownClass.__func__(cls)

    def setUp(self):
        harness.BrowserTests.setUp(self)
        self.requests, self.blocked = [], []
        self.tamper = False

        def route(request):
            url = request.request.url
            if urlsplit(url).netloc == urlsplit(self.url).netloc:
                request.continue_()
            elif url == XLSX_URL:
                self.requests.append(url)
                body = self.artifacts[url] + (b'\n/* altered bytes */' if self.tamper else b'')
                request.fulfill(body=body, content_type='text/javascript',
                                headers={'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store'})
            else:
                self.blocked.append(url)
                request.abort()
        self.context.route('**/*', route)

    tearDown = lambda self: harness.BrowserTests.tearDown(self)

    def test_actual_workbook_roundtrip_preserves_members_unicode_and_nested_inputs(self):
        result = self.page.evaluate('''async () => {
          const lib=await pfXlsxLib(),model=blankState();model.name='Café 東京';model.externalId='original-host';
          model.custom={flag:false,zero:0,small:1e-9};
          model.tgroups=[{id:'a',name:'Industrial'},{id:'b',name:'Credit'}];
          model.tenants=[{id:'tenant',name:'A & B',sf:1234.5,start:'2026-01',end:'2030-12',rent:24.125,
            group:'a',groups:['a','b'],rentBasis:'psfyr',step:0.03125,baseYear:'2024',sched:[{id:'step',date:'2027-01-15',amt:0.025,type:'step',units:'pct'}]},
            {id:'legacy',name:'Legacy',group:'a'},{id:'cleared',name:'Cleared',group:'',groups:[]}];
          const member=Object.assign(blankState(),{name:'Excluded member',externalId:'original-member'});
          model.portfolio=[{id:'member',name:'Member label',include:false,model:member}];
          const pkg=pfPackage(model,{results:false,members:true}),expected=pfUnpackJSON(JSON.parse(JSON.stringify(pkg.json)));
          const bytes=pfToXLSX(pkg,lib),actual=await pfReadFile(new File([bytes],'original.basis.xlsx'));
          return {version:lib.version,signature:[...bytes.slice(0,4)],expected:expected.props,actual:actual.props,check:actual.check};
        }''')
        self.assertEqual(result['version'], '0.20.3')
        self.assertEqual(result['signature'], [80, 75, 3, 4])
        self.assertEqual(populated_inputs(result['actual']), populated_inputs(result['expected']))
        tenants = result['actual'][0]['st']['tenants']
        self.assertEqual(tenants[0]['groups'], ['a', 'b'])
        self.assertNotIn('groups', tenants[1])
        self.assertEqual(tenants[2]['groups'], [])
        self.assertEqual(result['check'], 'match')
        self.assertEqual(len(self.requests), 1)
        self.assertEqual(self.blocked, [])

    def test_actual_excel_edits_and_1904_dates_keep_numeric_and_year_values(self):
        result = self.page.evaluate('''async () => {
          const lib=await pfXlsxLib(),model=blankState();model.name='Excel edited';
          model.tenants=[{id:'tenant',name:'Tenant',sf:1000,start:'2026-01',end:'2030-12',rent:20,step:.03,baseYear:'2024'}];
          const pkg=pfPackage(model,{results:false}),wb=lib.read(pfToXLSX(pkg,lib),{type:'array'});
          wb.Workbook.WBProps={...(wb.Workbook.WBProps||{}),date1904:true};
          const table=lib.utils.sheet_to_json(wb.Sheets.Tenants,{header:1}),set=(name,cell)=>{
            const col=table[0].indexOf(name);if(col<0)throw Error('Missing fixture column '+name);
            wb.Sheets.Tenants[lib.utils.encode_cell({r:1,c:col})]=cell;
          };
          set('start',{t:'n',v:45000,z:'yyyy-mm-dd'});set('rent',{t:'n',v:24.125});set('step',{t:'n',v:.07125});
          set('baseYear',{t:'n',v:2024});
          const bytes=lib.write(wb,{type:'array',bookType:'xlsx'}),actual=await pfReadFile(new File([bytes],'edited.xlsx'));
          return {tenant:actual.props[0].st.tenants[0],check:actual.check};
        }''')
        self.assertEqual(result['tenant']['start'], '2027-03-16')
        self.assertEqual(result['tenant']['rent'], 24.125)
        self.assertEqual(result['tenant']['step'], .07125)
        self.assertEqual(result['tenant']['baseYear'], 2024)
        self.assertEqual(result['check'], 'edited')
        self.assertEqual(self.blocked, [])

    def test_actual_report_cells_keep_precision_before_structured_import(self):
        result = self.page.evaluate('''async () => {
          const lib=await pfXlsxLib(),wb=lib.utils.book_new(),values=[1234567890.12345,123456789012.34,0.000000123456789012345,1.23456789012345e9,0,12.125];
          lib.utils.book_append_sheet(wb,lib.utils.aoa_to_sheet([
            ['Expenses - Operating Expenses'],['Name','How Input','Amount1'],['Operating','Amount',0],
            ['Investment - Property Purchase'],['Purchase Date','Purchase Price'],['1/1/2026',1234567890.12345]
          ]),'Input Assumptions Report');
          lib.utils.book_append_sheet(wb,lib.utils.aoa_to_sheet([['Value'],...values.map(value=>[value])]),'Precision probes');
          const bytes=new Uint8Array(lib.write(wb,{type:'array',bookType:'xlsx',compression:true}));
          const sheets=await intXlsx(await intUnzip(bytes),{keepRows:true});
          const report=sheets.find(sheet=>sheet.name==='Input Assumptions Report'),probes=sheets.find(sheet=>sheet.name==='Precision probes');
          return {price:axImport(report.rows).S.price,numbers:probes.rows.slice(1).map(row=>Number(row[0]))};
        }''')
        self.assertEqual(result['price'], 1234567890.12345)
        self.assertEqual(result['numbers'], [1234567890.12345, 123456789012.34, 0.000000123456789012345, 1.23456789012345e9, 0, 12.125])
        self.assertEqual(self.blocked, [])

    def test_export_keeps_original_inputs_filename_and_library_across_wait(self):
        result = self.page.evaluate('''async () => {
          const lib=await pfXlsxLib(),originalLoad=pfXlsxLib,originalOffer=offerFile,originalGlobal=globalThis.XLSX;
          let release,saved;pfXlsxLib=()=>new Promise(resolve=>{release=resolve;});
          offerFile=async(name,bytes)=>{saved={name,bytes};return 'saved';};
          try{
            S.name='Original export';PF_OPTS.results=false;PF_OPTS.members=false;PF_OPTS.mode='full';
            const pending=pfExport('xlsx');S.name='Later edit';PF_OPTS.mode='results';globalThis.XLSX={broken:true};
            release(lib);await pending;
            const wb=lib.read(saved.bytes,{type:'array'}),actual=pfUnpack(pfWorkbookTables(wb,lib));
            return {name:saved.name,model:actual.props[0].st.name,current:S.name};
          }finally{pfXlsxLib=originalLoad;offerFile=originalOffer;globalThis.XLSX=originalGlobal;}
        }''')
        self.assertEqual(result, {'name': 'Original_export.basis.xlsx', 'model': 'Original export', 'current': 'Later edit'})
        self.assertEqual(self.blocked, [])

    def test_browser_rejects_tampered_script_integrity_then_allows_retry(self):
        self.tamper = True
        first = self.page.evaluate('''async () => {
          try{await pfXlsxLib();return {unexpected:true};}catch(error){return {name:error.name,code:error.code,loaded:typeof XLSX!=='undefined'};}
        }''')
        self.assertEqual(first, {'name': 'XlsxLoadError', 'code': 'xlsx_load_failed', 'loaded': False})
        self.tamper = False
        self.assertEqual(self.page.evaluate('pfXlsxLib().then(lib=>lib.version)'), '0.20.3')
        self.assertEqual(len(self.requests), 2)
        self.assertEqual(self.blocked, [])

    def read_real_tables(self, tables, cells=None, date1904=False):
        """Write independent rows as actual OOXML, then enter the app file path."""
        return self.page.evaluate('''async ({tables,cells,date1904}) => {
          const lib=await pfXlsxLib(),wb=lib.utils.book_new();
          for(const [name,rows] of Object.entries(tables))
            lib.utils.book_append_sheet(wb,lib.utils.aoa_to_sheet(rows),name);
          wb.Workbook={WBProps:{date1904}};
          const address=change=>{
            const col=tables[change.sheet][0].indexOf(change.column);
            if(col<0)throw Error('Missing independent fixture column '+change.column);
            return lib.utils.encode_cell({r:change.row??1,c:col});
          };
          for(const change of cells)wb.Sheets[change.sheet][address(change)]={...change.cell};
          const bytes=new Uint8Array(lib.write(wb,{type:'array',bookType:'xlsx'}));
          const source=lib.read(bytes,{type:'array',cellFormula:true,sheetStubs:true,cellNF:true});
          const sourceCells=cells.map(change=>source.Sheets[change.sheet][address(change)]||null);
          try{
            const actual=await pfReadFile(new File([bytes],'independent-compatibility.xlsx'));
            return {ok:true,actual,sourceCells};
          }catch(error){return {ok:false,error:error.message,sourceCells};}
        }''', {'tables': tables, 'cells': cells or [], 'date1904': date1904})

    def test_independent_styled_dates_respect_both_excel_epochs(self):
        for date1904, expected in [(False, '2023-03-15'), (True, '2027-03-16')]:
            with self.subTest(date1904=date1904):
                result = self.read_real_tables({
                    'Properties': [['Property_ID', 'name'], ['dates', 'Date compatibility']],
                    'Tenants': [['Property_ID', 'id', 'start', 'end', 'rent', 'baseYear'],
                                ['dates', 'dated', None, '2030-12', 45000, 2024],
                                ['dates', 'iso', '2028-02-01', '2028-02-29', 0, '2024']],
                    'Loans': [['Property_ID', 'id', 'start', 'end'], ['dates', 'loan', None, '2035-01']],
                }, [{'sheet': 'Tenants', 'column': 'start', 'cell': {'t': 'n', 'v': 45000, 'z': 'yyyy-mm-dd'}},
                    {'sheet': 'Loans', 'column': 'start', 'cell': {'t': 'n', 'v': 45000, 'z': 'yyyy-mm-dd'}}], date1904)
                self.assertTrue(result['ok'], result)
                dated, iso = result['actual']['props'][0]['st']['tenants']
                self.assertEqual(dated['start'], expected)
                self.assertEqual(dated['rent'], 45000, 'A numeric amount must not receive the workbook date offset')
                self.assertEqual(dated['baseYear'], 2024)
                self.assertEqual((iso['start'], iso['end'], iso['baseYear']), ('2028-02', '2028-02', '2024'))
                self.assertEqual(result['actual']['props'][0]['st']['loans'][0]['start'], expected)
                self.assertEqual(result['sourceCells'][0]['t'], 'n')
                self.assertIn('yyyy', result['sourceCells'][0]['z'])
        self.assertEqual(self.blocked, [])

    def test_inflation_indices_are_checked_before_expansion_and_sparse_rates_survive(self):
        tables = {
            'Properties': [['Property_ID', 'name'], ['p', 'Inflation fixture']],
            'InflationSeries': [['Property_ID', 'id', 'name'], ['p', 'curve', 'Fixture curve']],
            'InflationRates': [['Property_ID', 'Series_ID', 'Year_Index', 'Rate'],
                               ['p', 'curve', '3', .025], ['p', 'curve', 0, 0], ['p', 'curve', 1, .03]],
        }
        valid = self.read_real_tables(tables)
        self.assertTrue(valid['ok'], valid)
        self.assertEqual(valid['actual']['props'][0]['st']['infl'][0]['rates'], [0, .03, 0, .025])
        # The first unsupported index is enough to exercise the guard through
        # real OOXML without risking a browser lockup if this regression returns.
        for index in [100000, -1, 1.5, 'invalid', None]:
            with self.subTest(index=index):
                invalid = {**tables, 'InflationRates': [tables['InflationRates'][0], ['p', 'curve', index, .03]]}
                result = self.read_real_tables(invalid)
                self.assertFalse(result['ok'], result)
                self.assertRegex(result['error'], 'InflationRates Year_Index.*integer from 0 to 99999')
        self.assertEqual(self.blocked, [])

    def test_unicode_and_leading_zero_ids_keep_distinct_parent_and_category_references(self):
        result = self.read_real_tables({
            'Properties': [['Property_ID', 'name', 'externalId'], ['物件-001', 'Café 東京', '000042']],
            'Tenants': [['Property_ID', 'id', 'name', 'mla', 'rec', 'cpi'],
                        ['物件-001', '0007', 'Étage 東', '0003', '回収-01', '0004'],
                        ['物件-001', '7', 'Separate tenant', '3', None, None]],
            'MarketLeasing': [['Property_ID', 'id', 'name', 'mrNewRef'],
                              ['物件-001', '0003', 'Marché', '賃料-001'], ['物件-001', '3', 'Other profile', None]],
            'MarketRents': [['Property_ID', 'id', 'name', 'amt'], ['物件-001', '賃料-001', 'Rent 東京', 23.75]],
            'RecoveryStructures': [['Property_ID', 'id', 'name'], ['物件-001', '回収-01', 'Recovery']],
            'CPICategories': [['Property_ID', 'id', 'name'], ['物件-001', '0004', 'CPI']],
            'RentSteps': [['Property_ID', 'Tenant_ID', 'Order', 'id', 'date', 'amt', 'type', 'units'],
                          ['物件-001', '0007', 2, 'second', '2028-01-15', .02, 'step', 'pct'],
                          ['物件-001', '7', 1, 'other', '2027-01-15', .01, 'step', 'pct'],
                          ['物件-001', '0007', 1, 'first', '2027-01-15', .015, 'step', 'pct']],
        })
        self.assertTrue(result['ok'], result)
        prop = result['actual']['props'][0]
        self.assertEqual((prop['pid'], prop['st']['externalId'], prop['st']['name']), ('物件-001', '000042', 'Café 東京'))
        first, second = prop['st']['tenants']
        self.assertEqual((first['id'], first['mla'], first['rec'], first['cpi']), ('0007', '0003', '回収-01', '0004'))
        self.assertEqual([step['id'] for step in first['sched']], ['first', 'second'])
        self.assertEqual((second['id'], second['mla'], [step['id'] for step in second['sched']]), ('7', '3', ['other']))
        self.assertEqual(prop['st']['mlas'][0]['mrNewRef'], '賃料-001')
        self.assertFalse(any('parent that does not exist' in warning for warning in result['actual']['warnings']))
        self.assertEqual(self.blocked, [])

    def test_literal_formula_like_text_stays_text_after_import_and_reexport(self):
        literals = ['=1+1', '+SUM(A1:A2)', '-1+2', '@SUM(A1:A2)', '=HYPERLINK("https://example.invalid","東京")']
        result = self.page.evaluate('''async literals => {
          const lib=await pfXlsxLib(),wb=lib.utils.book_new();
          lib.utils.book_append_sheet(wb,lib.utils.aoa_to_sheet([['Property_ID','name'],['p','=1+1']]),'Properties');
          lib.utils.book_append_sheet(wb,lib.utils.aoa_to_sheet([['Property_ID','id','name'],
            ...literals.map((value,i)=>['p','text-'+i,value])]),'Tenants');
          const bytes=lib.write(wb,{type:'array',bookType:'xlsx'});
          const actual=await pfReadFile(new File([bytes],'literal-text.xlsx'));
          const again=lib.read(pfToXLSX(pfPackage(actual.props[0].st,{results:false}),lib),{type:'array'});
          const rows=lib.utils.sheet_to_json(again.Sheets.Tenants,{header:1,raw:true}),col=rows[0].indexOf('name');
          const cells=literals.map((_,i)=>again.Sheets.Tenants[lib.utils.encode_cell({r:i+1,c:col})]);
          return {name:actual.props[0].st.name,values:actual.props[0].st.tenants.map(t=>t.name),
            cells:cells.map(cell=>({type:cell.t,value:cell.v,formula:cell.f??null}))};
        }''', literals)
        self.assertEqual(result['name'], '=1+1')
        self.assertEqual(result['values'], literals)
        self.assertEqual(result['cells'], [{'type': 's', 'value': value, 'formula': None} for value in literals])
        self.assertEqual(self.blocked, [])

    def test_actual_formula_cells_import_cached_snapshots_without_recalculation(self):
        result = self.read_real_tables({
            'Properties': [['Property_ID', 'name', 'price', 'custom.empty', 'custom.flag'],
                           ['formula', 'Formula snapshots', None, None, None]],
            'Tenants': [['Property_ID', 'id', 'name', 'rent'], ['formula', 'cached', None, None],
                        ['formula', 'zero', 'Zero cached value', None]],
        }, [
            {'sheet': 'Properties', 'column': 'price', 'cell': {'t': 'n', 'f': '1+1', 'v': 625000}},
            {'sheet': 'Properties', 'column': 'custom.empty', 'cell': {'t': 's', 'f': '""', 'v': ''}},
            {'sheet': 'Properties', 'column': 'custom.flag', 'cell': {'t': 'b', 'f': 'FALSE()', 'v': False}},
            {'sheet': 'Tenants', 'column': 'name', 'cell': {'t': 's', 'f': '"Acme"&" Tenant"', 'v': 'Acme Tenant'}},
            {'sheet': 'Tenants', 'column': 'rent', 'cell': {'t': 'n', 'f': '1+1', 'v': 24.125}},
            {'sheet': 'Tenants', 'column': 'rent', 'row': 2, 'cell': {'t': 'n', 'f': '1-1', 'v': 0}},
        ])
        self.assertTrue(result['ok'], result)
        model = result['actual']['props'][0]['st']
        self.assertEqual(model['price'], 625000, 'Import consumes the cached snapshot and must not evaluate spreadsheet formulas')
        self.assertNotIn('empty', model['custom'], 'A valid cached empty string follows ordinary blank-cell normalization')
        self.assertIs(model['custom']['flag'], False)
        self.assertEqual((model['tenants'][0]['name'], model['tenants'][0]['rent'], model['tenants'][1]['rent']), ('Acme Tenant', 24.125, 0))
        self.assertEqual([cell['f'] for cell in result['sourceCells']], ['1+1', '""', 'FALSE()', '"Acme"&" Tenant"', '1+1', '1-1'])
        self.assertEqual(self.blocked, [])

    def test_formula_cells_without_usable_cached_values_fail_instead_of_becoming_zero(self):
        tables = {'Properties': [['Property_ID', 'name'], ['formula', 'Missing formula cache']],
                  'Tenants': [['Property_ID', 'id', 'name', 'rent'], ['formula', 'tenant', 'Tenant', None]]}
        for cell in [{'t': 'n', 'f': '40+2'}, {'t': 'e', 'f': '1/0', 'v': 7}, {'t': 'e', 'v': 7}]:
            with self.subTest(cell=cell):
                result = self.read_real_tables(tables, [{'sheet': 'Tenants', 'column': 'rent', 'cell': cell}])
                self.assertFalse(result['ok'], 'An uncached/error formula must not silently become a blank rent')
                self.assertRegex(result['error'], '(?i)formula|cached|recalculate|spreadsheet.*error')
        self.assertEqual(self.blocked, [])

    def test_uncached_formulas_and_errors_on_ignored_sheets_do_not_block_inputs(self):
        result = self.read_real_tables({
            'Properties': [['Property_ID', 'name'], ['inputs', 'Valid independent inputs']],
            'Tenants': [['Property_ID', 'id', 'name', 'rent'], ['inputs', 'tenant', 'Tenant', 31.25]],
            'Results_Valuation': [['Property_ID', 'Price', 'Error'], ['inputs', None, None]],
            'AnalystNotes': [['note'], [None]],
        }, [
            {'sheet': 'Results_Valuation', 'column': 'Price', 'cell': {'t': 'n', 'f': '1+1'}},
            {'sheet': 'Results_Valuation', 'column': 'Error', 'cell': {'t': 'e', 'f': '1/0', 'v': 7}},
            {'sheet': 'AnalystNotes', 'column': 'note', 'cell': {'t': 'n', 'f': '1+1'}},
        ])
        self.assertTrue(result['ok'], result)
        self.assertEqual(result['sourceCells'][0]['f'], '1+1', 'The ignored result fixture must really contain a formula')
        self.assertEqual(result['sourceCells'][1]['t'], 'e')
        self.assertEqual(result['actual']['props'][0]['st']['tenants'][0]['rent'], 31.25)
        self.assertEqual(self.blocked, [])

    def test_independent_multi_member_workbook_preserves_exclusions_and_member_order(self):
        result = self.read_real_tables({
            'Properties': [['Property_ID', 'name'], ['host', 'Host'], ['002', 'Same name'], ['003', 'Same name'], ['004', 'Included']],
            'Portfolio': [['Host_Property_ID', 'Property_ID', 'Member_ID', 'Name', 'Include'],
                          ['host', '003', '0003', 'Excluded by boolean', False],
                          ['host', '002', '0002', 'Excluded by text', 'no'],
                          ['host', '004', '0004', 'Included by text', 'yes'],
                          ['host', 'missing', 'orphan', 'Missing property', True]],
            'Dictionary': [['Sheet', 'Column', 'Type'], ['Portfolio', 'Include', 'boolean']],
        })
        self.assertTrue(result['ok'], result)
        self.assertEqual(result['actual']['host'], 'host')
        self.assertEqual([prop['pid'] for prop in result['actual']['props']], ['host', '002', '003', '004'])
        members = result['actual']['props'][0]['st']['portfolio']
        self.assertEqual([(member['id'], member['name'], member['include'], member['model']['name']) for member in members],
                         [('0003', 'Excluded by boolean', False, 'Same name'), ('0002', 'Excluded by text', False, 'Same name'),
                          ('0004', 'Included by text', True, 'Included')])
        self.assertTrue(any('not in the file' in warning for warning in result['actual']['warnings']))
        self.assertEqual(self.blocked, [])

    def test_unknown_additive_columns_nested_values_and_record_sheets_survive(self):
        result = self.read_real_tables({
            'Properties': [['Property_ID', 'name', 'custom.zero', 'custom.flag', 'custom.payload'],
                           ['future', 'Forward compatible', 0, False, '{"nested":[0,false,"東京"]}']],
            'Tenants': [['Property_ID', 'id', 'name', 'review.note'], ['future', 't', 'Tenant', 'Étage review']],
            'Other_auditRows': [['Property_ID', 'id', 'zero', 'flag', 'memo'], ['future', 'audit-01', 0, False, '未知項目']],
            'Dictionary': [['Sheet', 'Column', 'Type'], ['Properties', 'custom.payload', 'json']],
            'AnalystNotes': [['note'], ['This unrelated sheet must not overwrite inputs']],
            'Results_Valuation': [['Property_ID', 'price'], ['future', 999999999]],
        })
        self.assertTrue(result['ok'], result)
        model = result['actual']['props'][0]['st']
        self.assertEqual(model['custom'], {'zero': 0, 'flag': False, 'payload': {'nested': [0, False, '東京']}})
        self.assertEqual(model['tenants'][0]['review'], {'note': 'Étage review'})
        self.assertEqual(model['auditRows'], [{'id': 'audit-01', 'zero': 0, 'flag': False, 'memo': '未知項目'}])
        self.assertNotEqual(model['price'], 999999999, 'Result sheets cannot override model inputs')
        self.assertTrue(any('AnalystNotes' in warning for warning in result['actual']['warnings']))
        self.assertEqual(self.blocked, [])

    def test_previous_pinned_writer_workbook_imports_with_current_reader(self):
        old_url = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
        self.assertIn(old_url, self.artifacts, 'The previous writer must be separately pinned as a compatibility reference')
        result = self.page.evaluate('''async oldSource => {
          const current=await pfXlsxLib(),mainGlobal=globalThis.XLSX,frame=document.createElement('iframe');
          document.body.append(frame);
          try{
            frame.contentWindow.eval(oldSource);const old=frame.contentWindow.XLSX,wb=old.utils.book_new();
            old.utils.book_append_sheet(wb,old.utils.aoa_to_sheet([['Property_ID','name','externalId'],
              ['old-物件','Café old writer','000001']]),'Properties');
            old.utils.book_append_sheet(wb,old.utils.aoa_to_sheet([['Property_ID','id','name','start','rent','baseYear'],
              ['old-物件','0007','Tenant 東京',45000,24.125,'2024']]),'Tenants');
            wb.Sheets.Tenants.D2.z='yyyy-mm-dd';wb.Workbook={WBProps:{date1904:true}};
            const bytes=new Uint8Array(old.write(wb,{type:'array',bookType:'xlsx'}));
            const imported=await pfReadFile(new File([bytes],'trusted-previous-writer.xlsx'));
            return {oldVersion:old.version,newVersion:current.version,props:imported.props,
              libraryStable:await pfXlsxLib()===current&&globalThis.XLSX===mainGlobal};
          }finally{frame.remove();}
        }''', self.artifacts[old_url].decode('utf-8'))
        self.assertEqual((result['oldVersion'], result['newVersion']), ('0.18.5', '0.20.3'))
        self.assertTrue(result['libraryStable'], 'The compatibility writer must not replace the active reader')
        prop = result['props'][0]
        self.assertEqual((prop['pid'], prop['st']['name'], prop['st']['externalId']), ('old-物件', 'Café old writer', '000001'))
        tenant = prop['st']['tenants'][0]
        self.assertEqual((tenant['id'], tenant['name'], tenant['start'], tenant['rent'], tenant['baseYear']),
                         ('0007', 'Tenant 東京', '2027-03-16', 24.125, '2024'))
        self.assertEqual(self.blocked, [])


if __name__ == '__main__':
    unittest.main(verbosity=2)
