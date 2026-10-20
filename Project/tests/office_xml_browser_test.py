"""Native-browser XML parsing and Office document extraction, fully offline."""
import io
import unittest
import zipfile

import browser_test as browser_support

REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
WORD = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'


def archive(parts):
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zipped:
        for name, text in parts.items():
            zipped.writestr(name, text)
    return list(output.getvalue())


def word(body):
    return f'<w:document xmlns:w="{WORD}"><w:body>{body}</w:body></w:document>'


def paragraph(text):
    return f'<w:p><w:r><w:t>{text}</w:t></w:r></w:p>'


def workbook():
    def cell(ref, text):
        return f'<c r="{ref}" t="inlineStr"><is><t>{text}</t></is></c>'

    parts = {
        'xl/workbook.xml': f'<workbook xmlns:r="{REL}"><sheets><sheet name="PropertyAssets" r:id="a"/><sheet name="Leases" r:id="b"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="a" Target="worksheets/a.xml"/><Relationship Id="b" Target="worksheets/b.xml"/></Relationships>',
    }
    for identifier, name in [('a', 'Property'), ('b', 'Tenant')]:
        parts[f'xl/worksheets/{identifier}.xml'] = '<worksheet><sheetData><row r="1">' + cell('A1', 'COL') + cell('B1', 'Name') + '</row><row r="2">' + cell('B2', name) + '</row></sheetData></worksheet>'
    return parts


def workbook_cell(value_xml, shared_strings=None):
    """Original minimal input workbook, independent of either application writer."""
    main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'

    def cell(ref, text):
        return f'<c r="{ref}" t="inlineStr"><is><t>{text}</t></is></c>'

    parts = {
        '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
        'xl/workbook.xml': f'<workbook xmlns="{main}" xmlns:r="{REL}"><sheets><sheet name="PropertyAssets" sheetId="1" r:id="property"/><sheet name="Leases" sheetId="2" r:id="leases"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels': f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="property" Type="{REL}/worksheet" Target="worksheets/property.xml"/><Relationship Id="leases" Type="{REL}/worksheet" Target="worksheets/leases.xml"/></Relationships>',
        'xl/worksheets/property.xml': f'<worksheet xmlns="{main}"><sheetData><row r="2">'
            + cell('A2', 'COL') + cell('B2', 'Name') + cell('C2', 'Property_ExternalID')
            + cell('D2', 'PurchasePrice') + cell('E2', 'Comment') + '</row><row r="3">'
            + cell('B3', 'DOM fixture') + cell('C3', 'asset-001') + value_xml
            + cell('E3', '=SUM(A1) &lt;f&gt;literal text&lt;/f&gt;') + '</row></sheetData></worksheet>',
        'xl/worksheets/leases.xml': f'<worksheet xmlns="{main}"><sheetData><row r="2">'
            + cell('A2', 'COL') + cell('B2', 'Name') + '</row></sheetData></worksheet>',
    }
    if shared_strings is not None:
        parts['xl/sharedStrings.xml'] = f'<sst xmlns="{main}">{shared_strings}</sst>'
    return parts


class OfficeXmlTests(unittest.TestCase):
    setUpClass = classmethod(browser_support.BrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(browser_support.BrowserTests.tearDownClass.__func__)
    setUp = browser_support.BrowserTests.setUp
    tearDown = browser_support.BrowserTests.tearDown

    def test_malformed_or_missing_word_parts_are_recoverable_intake_errors(self):
        for parts in [
            {'word/styles.xml': '<styles/>'},
            {'word/document.xml': '<w:document xmlns:w="' + WORD + '"><w:body></w:document>'},
            {'word/document.xml': '<document/>'},
        ]:
            with self.subTest(parts=parts):
                result = self.page.evaluate('''async bytes => {
                  iReadClearDocuments();await intAdd([new File([new Uint8Array(bytes)],'lease.docx')]);
                  return {status:INT.docs[0].status,error:INT.docs[0].err};
                }''', archive(parts))
                self.assertEqual(result['status'], 'error')
                self.assertRegex(result['error'], 'missing|malformed')

    def test_nested_word_tables_extract_each_paragraph_once(self):
        nested = ''
        for depth in range(30, 0, -1):
            nested = '<w:tbl><w:tr><w:tc>' + paragraph(f'LEVEL_{depth:02}') + nested + '<w:p/></w:tc></w:tr></w:tbl>'
        result = self.page.evaluate('''async bytes => {
          const d={ext:'docx',pages:[],images:[]};
          await intRead(d,new File([new Uint8Array(bytes)],'nested.docx'));
          return {text:d.pages[0].text,chars:d.chars};
        }''', archive({'word/document.xml': word(nested)}))
        self.assertEqual(result['text'].splitlines(), [f'LEVEL_{depth:02}' for depth in range(1, 31)])
        self.assertEqual(result['chars'], len(result['text']))

    def test_powerpoint_namespace_prefix_and_referenced_slide_errors(self):
        slide = '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Slide text</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>'
        parts = {
            'ppt/presentation.xml': f'<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:rel="{REL}"><p:sldIdLst><p:sldId id="256" rel:id="slide1"/></p:sldIdLst></p:presentation>',
            'ppt/_rels/presentation.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="slide1" Target="slides/slide1.xml"/></Relationships>',
            'ppt/slides/slide1.xml': slide,
        }
        result = self.page.evaluate('''async bytes => intPptx(await intUnzip(new Uint8Array(bytes)))''', archive(parts))
        self.assertEqual(result, [{'n': 1, 'text': 'Slide text'}])
        for name in parts:
            invalid = {**parts, name: '<broken>'}
            error = self.page.evaluate('''async bytes => {
              try{await intPptx(await intUnzip(new Uint8Array(bytes)));return null;}
              catch(error){return error.message;}
            }''', archive(invalid))
            self.assertIn('malformed XML', error)

    def test_workbooks_reject_native_parser_errors_in_required_and_present_optional_parts(self):
        baseline = workbook()
        # The old regex reader accepted the intact rows in this truncated sheet.
        malformed = {**baseline, 'xl/worksheets/a.xml': baseline['xl/worksheets/a.xml'].replace('</worksheet>', '')}
        cases = [malformed]
        for name in ['xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/worksheets/a.xml', 'xl/sharedStrings.xml', 'xl/styles.xml']:
            cases.append({**baseline, name: '<broken>'})
        for parts in cases:
            result = self.page.evaluate('''async bytes => {
              const input=new Uint8Array(bytes),z=await intUnzip(input),errors=[];
              for(const read of [()=>intXlsx(z),()=>x4ReadTemplate(input)]){
                try{await read();errors.push(null);}catch(error){errors.push(error.message);}
              }
              return errors;
            }''', archive(parts))
            self.assertTrue(all('malformed XML' in error for error in result), result)

    def test_xml_declarations_fail_but_comment_and_cdata_text_are_preserved(self):
        result = self.page.evaluate('''() => {
          let error=null;
          try{intXML('<!DOCTYPE document [<!ENTITY value "lease">]><document>&value;</document>');}
          catch(failure){error=failure.message;}
          const text=intXML('<document><!-- <!DOCTYPE example> --><![CDATA[<!DOCTYPE example>]]></document>').documentElement.textContent;
          return {error,text};
        }''')
        self.assertIn('unsupported XML declarations', result['error'])
        self.assertEqual(result['text'], '<!DOCTYPE example>')

    def test_custom_workbook_formula_caches_and_errors_use_native_dom_with_cell_context(self):
        invalid = [
            '<c r="D3"><f>1+1</f></c>',
            '<c r="D3"><f t="shared" si="0"/></c>',
            '<c r="D3"><f t="array" ref="D3:D4">ROW(D3:D4)</f></c>',
            '<c r="D3"><f>1+1</f><!-- <v>42</v> --></c>',
            '<c r="D3"><f>1+1</f><![CDATA[<v>42</v>]]></c>',
            '<c r="D3"><ss:f xmlns:ss="http://schemas.openxmlformats.org/spreadsheetml/2006/main">1+1</ss:f></c>',
            '<c r="D3" t="n"><f>1+1</f><v>NaN</v></c>',
            '<c r="D3" t="e"><v>#DIV/0!</v></c>',
            '<c r="D3" t="e"><f>1/0</f><v>#DIV/0!</v></c>',
        ]
        for value_xml in invalid:
            with self.subTest(value_xml=value_xml):
                errors = self.page.evaluate('''async bytes => {
                  const input=new Uint8Array(bytes),z=await intUnzip(input),errors=[];
                  for(const read of [()=>intXlsx(z,{keepRows:true}),()=>x4ReadTemplate(input)]){
                    try{await read();errors.push(null);}catch(error){errors.push(error.message);}
                  }
                  return errors;
                }''', archive(workbook_cell(value_xml)))
                for error in errors:
                    self.assertIsInstance(error, str, errors)
                    self.assertIn('PropertyAssets!D3', error)
                    self.assertRegex(error, '(?i)formula|cached|Excel error')

        for cell_type, cached, expected, text in [('n', '0', 0, '0'), ('b', '0', False, 'FALSE'), ('str', '', '', '')]:
            with self.subTest(valid_cached_type=cell_type):
                value_xml = f'<c r="D3" t="{cell_type}"><f>0</f><v>{cached}</v></c>'
                result = self.page.evaluate('''async bytes => {
                  const input=new Uint8Array(bytes),T=await x4ReadTemplate(input),sheets=await intXlsx(await intUnzip(input),{keepRows:true});
                  const row=T.sheets.PropertyAssets.rows[0];
                  return {value:row[3],text:sheets.find(sheet=>sheet.name==='PropertyAssets').rows[2][3]??'',literal:row[4]};
                }''', archive(workbook_cell(value_xml)))
                self.assertEqual(result, {'value': expected, 'text': text, 'literal': '=SUM(A1) <f>literal text</f>'})
                if cell_type == 'b':
                    self.assertIs(result['value'], False)

    def test_custom_workbook_shared_string_references_reject_with_cell_context(self):
        entry = '<si><t>Only valid entry</t></si>'
        variants = [('0', None), ('0', ''), ('1', entry), ('-1', entry), ('0.5', entry),
                    ('not-an-index', entry), ('9007199254740992', entry), ('', entry), (None, entry)]
        for index, shared_strings in variants:
            with self.subTest(index=index, has_table=shared_strings is not None):
                value = '' if index is None else f'<v>{index}</v>'
                parts = workbook_cell(f'<c r="D3" t="s">{value}</c>', shared_strings)
                errors = self.page.evaluate('''async bytes => {
                  const input=new Uint8Array(bytes),z=await intUnzip(input),errors=[];
                  for(const read of [()=>intXlsx(z),()=>x4ReadTemplate(input)]){
                    try{await read();errors.push(null);}catch(error){errors.push(error.message);}
                  }
                  return errors;
                }''', archive(parts))
                for error in errors:
                    self.assertIsInstance(error, str, errors)
                    self.assertIn('PropertyAssets!D3', error)
                    self.assertRegex(error, '(?i)shared.string|index')

        comment_cache = workbook_cell('<c r="D3" t="s"><!-- <v>0</v> --></c>', entry)
        errors = self.page.evaluate('''async bytes => {
          const input=new Uint8Array(bytes),z=await intUnzip(input),errors=[];
          for(const read of [()=>intXlsx(z),()=>x4ReadTemplate(input)]){
            try{await read();errors.push(null);}catch(error){errors.push(error.message);}
          }
          return errors;
        }''', archive(comment_cache))
        for error in errors:
            self.assertIsInstance(error, str, errors)
            self.assertIn('PropertyAssets!D3', error)
            self.assertRegex(error, '(?i)shared.string|index')

        for shared_strings, expected in [('<si><t></t></si>', ''), ('<si><r><t>Café &amp; </t></r><r><t>東京</t></r></si>', 'Café & 東京')]:
            with self.subTest(valid_entry=shared_strings):
                result = self.page.evaluate('''async bytes => {
                  const input=new Uint8Array(bytes),T=await x4ReadTemplate(input),sheets=await intXlsx(await intUnzip(input),{keepRows:true});
                  return {value:T.sheets.PropertyAssets.rows[0][3],
                    text:sheets.find(sheet=>sheet.name==='PropertyAssets').rows[2][3]??''};
                }''', archive(workbook_cell('<c r="D3" t="s"><v>0</v></c>', shared_strings)))
                self.assertEqual(result, {'value': expected, 'text': expected})


if __name__ == '__main__':
    unittest.main()
