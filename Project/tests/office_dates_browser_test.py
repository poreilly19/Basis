"""Offline integration of independently assembled OOXML date-epoch fixtures."""
import io
import unittest
import zipfile

import browser_test as browser_support


def workbook(setting, styles=None):
    main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    names = ['PropertyAssets', 'Leases']

    def cell(ref, text):
        return f'<c r="{ref}" t="inlineStr"><is><t>{text}</t></is></c>'

    parts = {
        '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
        'xl/workbook.xml': f'<workbook xmlns="{main}" xmlns:r="{rel}"><workbookPr date1904="{setting}"/><sheets>' + ''.join(f'<sheet name="{name}" sheetId="{i+1}" r:id="r{i}"/>' for i, name in enumerate(names)) + '</sheets></workbook>',
        'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + ''.join(f'<Relationship Id="r{i}" Type="{rel}/worksheet" Target="worksheets/sheet{i}.xml"/>' for i in range(2)) + '</Relationships>',
        'xl/styles.xml': styles or f'<styleSheet xmlns="{main}"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>',
    }
    for i, name in enumerate(names):
        header = cell('A1', 'COL') + cell('B1', 'Name') + cell('C1', 'Property_ExternalID') + cell('D1', 'AnalysisBegin') + cell('E1', 'PurchasePrice')
        data = cell('B2', name) + cell('C2', 'asset') + '<c r="D2" s="1"><v>45000</v></c><c r="E2" s="0"><v>45000</v></c>'
        parts[f'xl/worksheets/sheet{i}.xml'] = f'<worksheet xmlns="{main}"><sheetData><row r="1">{header}</row><row r="2">{data}</row></sheetData></worksheet>'
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, text in parts.items():
            archive.writestr(name, text)
    return list(output.getvalue())


class OfficeDateTests(unittest.TestCase):
    # Share the offline server/page lifecycle without inheriting its other tests.
    setUpClass = classmethod(browser_support.BrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(browser_support.BrowserTests.tearDownClass.__func__)
    setUp = browser_support.BrowserTests.setUp
    tearDown = browser_support.BrowserTests.tearDown

    def test_real_xml_date_epochs_import_and_export(self):
        for setting, expected in [('1', '2027-03-16'), ('true', '2027-03-16'), ('0', '2023-03-15'), ('false', '2023-03-15')]:
            with self.subTest(setting=setting):
                result = self.page.evaluate('''async bytes => {
                  const input=new Uint8Array(bytes),T=await x4ReadTemplate(input);
                  const sheets=await intXlsx(await intUnzip(input));
                  const A={sheets:Object.fromEntries(Object.entries(T.sheets).map(([name,s])=>[name,s.rows]))};
                  const output=await x4WriteWorkbook(T,A,null),roundtrip=await x4ReadTemplate(output);
                  return {epoch:T.date1904,text:sheets[1].rows[1][3],date:T.sheets.Leases.rows[0][3].d,
                    roundtrip:roundtrip.sheets.Leases.rows[0][3].d};
                }''', workbook(setting))
                self.assertEqual(result, {'epoch': setting in ('1', 'true'), 'text': expected, 'date': expected, 'roundtrip': expected})

    def test_invalid_epoch_and_shifted_date_limits_are_recoverable(self):
        result = self.page.evaluate('''async bytes => {
          try {await x4ReadTemplate(new Uint8Array(bytes));return null;}
          catch(error){return error.message;}
        }''', workbook('yes'))
        self.assertIn('invalid date1904', result)
        self.assertEqual(self.page.evaluate('''() => {
          try{officeSheetDate(2957004,false,true);return null;}catch(error){return error.message;}
        }'''), 'Workbook contains an invalid Excel date serial')

    def test_equivalent_styles_keep_dates_and_actual_import_start_in_both_epochs(self):
        main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
        styles = [
            f"<styleSheet xmlns='{main}'><cellXfs><xf numFmtId='0'/><xf applyNumberFormat='1' numFmtId='14'/></cellXfs></styleSheet>",
            f'<s:styleSheet xmlns:s="{main}"><s:cellXfs><s:xf numFmtId="0"/><s:xf numFmtId="14"/></s:cellXfs></s:styleSheet>',
            f'<styleSheet xmlns="{main}"><numFmts><numFmt formatCode="yyyy-mm-dd" numFmtId="164"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>',
            f'<s:styleSheet xmlns:s="{main}"><s:numFmts><s:numFmt formatCode="&quot;posted&quot; yyyy-mm-dd" numFmtId="164"/></s:numFmts><s:cellXfs><s:xf numFmtId="0"/><s:xf numFmtId="164"/></s:cellXfs></s:styleSheet>',
        ]
        for style in styles:
            for setting, expected in [('0', '2023-03-15'), ('1', '2027-03-16')]:
                with self.subTest(style=style, setting=setting):
                    result = self.page.evaluate('''async bytes => {
                      const input=new Uint8Array(bytes),T=await x4ReadTemplate(input),I=x4Import(T,'asset');
                      const sheets=await intXlsx(await intUnzip(input));
                      return {date:T.sheets.PropertyAssets.rows[0][3].d,text:sheets[0].rows[1][3],
                        year:I.S.startYear,month:I.S.startMonth,price:I.S.price};
                    }''', workbook(setting, style))
                    self.assertEqual(result, {'date': expected, 'text': expected, 'year': int(expected[:4]), 'month': 3, 'price': 45000})


if __name__ == '__main__':
    unittest.main()
