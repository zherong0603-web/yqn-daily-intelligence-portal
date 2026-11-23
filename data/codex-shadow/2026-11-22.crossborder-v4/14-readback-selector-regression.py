# coding: utf-8
"""Regression checks execute only the sender's pure selector, never its send path."""
import ast
from pathlib import Path
import re
import unittest
from datetime import datetime,timedelta,timezone

source=Path(__file__).with_name('11-delivery-continuation.py')
module=ast.parse(source.read_text())
ns={'re':re,'datetime':datetime,'timedelta':timedelta,'tz':timezone(timedelta(hours=8))}
nodes=[n for n in module.body if isinstance(n,ast.FunctionDef) and n.name in {'normalized','matching_delivery_messages','delivery_readback_window'}]
assert len(nodes)==3
exec(compile(ast.Module(body=nodes,type_ignores=[]),str(source),'exec'),ns)
select=ns['matching_delivery_messages']
head='尾程换档：报价包没包？'
body='先查承运商。\n\n再对合同和账单。'
message={'text':'**'+head+'**\n先查承运商。  \n再对合同和账单。'}

class RenderedTitleRegression(unittest.TestCase):
    def test_markdown_headline_without_cli_date_is_accepted(self):
        self.assertEqual(select([message],['跨境早知道 V4｜2026-11-22',head],body),[message])
    def test_cli_date_and_complete_body_still_work(self):
        m={'text':'跨境早知道 V4｜2026-11-22\n'+body}
        self.assertEqual(len(select([m],['跨境早知道 V4｜2026-11-22',head],body)),1)
    def test_wrong_headline_is_rejected(self):
        self.assertEqual(select([{'text':'其他期次\n'+body}],[head],body),[])
    def test_partial_body_is_rejected(self):
        self.assertEqual(select([{'text':head+'\n先查承运商。'}],[head],body),[])
    def test_duplicate_messages_remain_two_so_uniqueness_gate_rejects(self):
        self.assertEqual(len(select([message,message],[head],body)),2)
    def test_empty_expected_content_is_rejected(self):
        self.assertEqual(select([message],[''],body),[])
        self.assertEqual(select([message],[head],''),[])
    def test_non_text_and_malformed_rows_are_ignored(self):
        self.assertEqual(select([None,{}, {'text':None}, message],[head],body),[message])

class ReceiptWindowRegression(unittest.TestCase):
    def test_slow_delivery_at_330_seconds_stays_inside_window(self):
        start=datetime.fromisoformat('2026-11-22T16:00:00+08:00')
        receipt=start+timedelta(seconds=330)
        begin,end=ns['delivery_readback_window'](start.isoformat(),receipt.isoformat())
        self.assertLessEqual(begin,start)
        self.assertGreater(end,receipt)
        self.assertEqual(end,receipt+timedelta(minutes=2))
    def test_utc_and_shanghai_stamps_share_one_window(self):
        begin,end=ns['delivery_readback_window']('2026-11-22T08:00:00Z','2026-11-22T16:00:08+08:00')
        self.assertEqual(begin.isoformat(),'2026-11-22T15:59:58+08:00')
        self.assertEqual(end.isoformat(),'2026-11-22T16:02:08+08:00')
    def test_invalid_time_order_is_rejected(self):
        with self.assertRaises(ValueError):
            ns['delivery_readback_window']('2026-11-22T08:00:00Z','2026-11-22T07:59:59Z')

if __name__=='__main__':
    unittest.main()
