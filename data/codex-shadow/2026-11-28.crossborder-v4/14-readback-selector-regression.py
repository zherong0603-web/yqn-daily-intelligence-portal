# coding: utf-8
"""Regression checks execute only the sender's pure selector, never its send path."""
import ast
from pathlib import Path
import re,json
import unittest
from datetime import datetime,timedelta,timezone

source=Path(__file__).with_name('11-delivery-continuation.py')
module=ast.parse(source.read_text())
ns={'re':re,'datetime':datetime,'timedelta':timedelta,'tz':timezone(timedelta(hours=8))}
nodes=[n for n in module.body if isinstance(n,ast.FunctionDef) and n.name in {'normalized','matching_delivery_messages','delivery_readback_window','matched_delivery_units'}]
assert len(nodes)==4
exec(compile(ast.Module(body=nodes,type_ignores=[]),str(source),'exec'),ns)
select=ns['matching_delivery_messages']
head='退货没回仓，为什么钱先退了？'
body='先核退款交易。\n\n再对退运单和实际收货。'
message={'text':'**'+head+'**\n先核退款交易。  \n再对退运单和实际收货。'}

class RenderedTitleRegression(unittest.TestCase):
    def test_markdown_headline_without_cli_date_is_accepted(self):
        self.assertEqual(select([message],['跨境早知道 V4｜2026-11-28',head],body),[message])
    def test_cli_date_and_complete_body_still_work(self):
        m={'text':'跨境早知道 V4｜2026-11-28\n'+body}
        self.assertEqual(len(select([m],['跨境早知道 V4｜2026-11-28',head],body)),1)
    def test_wrong_headline_is_rejected(self):
        self.assertEqual(select([{'text':'其他期次\n'+body}],[head],body),[])
    def test_partial_body_is_rejected(self):
        self.assertEqual(select([{'text':head+'\n先核退款交易。'}],[head],body),[])
    def test_duplicate_messages_remain_two_so_uniqueness_gate_rejects(self):
        self.assertEqual(len(select([message,message],[head],body)),2)
    def test_empty_expected_content_is_rejected(self):
        self.assertEqual(select([message],[''],body),[])
        self.assertEqual(select([message],[head],''),[])
    def test_non_text_and_malformed_rows_are_ignored(self):
        self.assertEqual(select([None,{}, {'text':None}, message],[head],body),[message])

class ReceiptWindowRegression(unittest.TestCase):
    def test_slow_delivery_at_330_seconds_stays_inside_window(self):
        start=datetime.fromisoformat('2026-11-28T16:00:00+08:00')
        receipt=start+timedelta(seconds=330)
        begin,end=ns['delivery_readback_window'](start.isoformat(),receipt.isoformat())
        self.assertLessEqual(begin,start)
        self.assertGreater(end,receipt)
        self.assertEqual(end,receipt+timedelta(minutes=2))
    def test_utc_and_shanghai_stamps_share_one_window(self):
        begin,end=ns['delivery_readback_window']('2026-11-28T08:00:00Z','2026-11-28T16:00:08+08:00')
        self.assertEqual(begin.isoformat(),'2026-11-28T15:59:58+08:00')
        self.assertEqual(end.isoformat(),'2026-11-28T16:02:08+08:00')
    def test_invalid_time_order_is_rejected(self):
        with self.assertRaises(ValueError):
            ns['delivery_readback_window']('2026-11-28T08:00:00Z','2026-11-28T07:59:59Z')

class CandidateOrdinalRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture=json.loads(source.with_name('16-candidate-list-rendering-fixture.json').read_text())
        archived=source.parent.parent/'2026-11-26.crossborder-v2.json'
        cls.candidates=json.loads(archived.read_text())['editorial']['candidates']
    def unit(self,expected,rendered,body='金额75美元，日期2026年11月26日。'):
        markdown='## 5条重点候选\n\n'+expected+'\n\n## 口播正文\n\n'+body+'\n'
        seen=ns['normalized']('5条重点候选\n'+rendered+'\n口播正文\n'+body)
        return ns['matched_delivery_units'](markdown,seen,self.candidates)
    def test_all_four_actual_candidate_renderings_match_in_full(self):
        for pair in self.fixture['pairs']:
            with self.subTest(pair=pair['expected'][:3]):
                result=self.unit(pair['expected'],pair['rendered'])
                self.assertEqual(result['matched'],result['total'])
                self.assertEqual(result['strict_matched'],result['total']-1)
                self.assertEqual(len(result['candidate_ordinal_adjustments']),1)
    def test_fact_number_change_in_candidate_is_rejected(self):
        pair=self.fixture['pairs'][0]
        bad=re.sub(r'\d{2}',lambda m:str(int(m.group())+1),pair['rendered'],count=1)
        result=self.unit(pair['expected'],bad)
        self.assertLess(result['matched'],result['total'])
    def test_missing_whole_candidate_is_rejected(self):
        pair=self.fixture['pairs'][0]; result=self.unit(pair['expected'],'')
        self.assertLess(result['matched'],result['total'])
    def test_missing_candidate_reason_is_rejected(self):
        pair=self.fixture['pairs'][0]; reason=next(c['reason'] for c in self.candidates if c['title'] in pair['expected'])
        result=self.unit(pair['expected'],pair['rendered'].replace(reason,''))
        self.assertLess(result['matched'],result['total'])
    def test_body_date_and_money_changes_are_still_rejected(self):
        body='金额75美元，日期2026年11月26日。'; head='审核稿'
        for wrong in ['金额76美元，日期2026年11月26日。','金额75美元，日期2026年11月27日。']:
            self.assertEqual(select([{'text':head+'\n'+wrong}],[head],body),[])
    def test_step_number_outside_candidate_section_is_not_normalized(self):
        markdown='## 5条重点候选\n\n普通说明\n\n## 口播正文\n\n2. 核75美元费用。\n'
        seen=ns['normalized']('5条重点候选\n普通说明\n口播正文\n1. 核75美元费用。')
        result=ns['matched_delivery_units'](markdown,seen,self.candidates)
        self.assertLess(result['matched'],result['total'])
    def test_numbered_non_candidate_inside_section_is_not_normalized(self):
        result=self.unit('2. 提醒核75美元。','1. 提醒核75美元。')
        self.assertLess(result['matched'],result['total'])

if __name__=='__main__':
    unittest.main()
