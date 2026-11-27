# coding: utf-8
"""Pure extracted helpers only; no approved sender top-level is executed."""
import ast,contextlib,json,os,signal,subprocess,sys,tempfile,time
from pathlib import Path
from datetime import datetime,timedelta,timezone
repo=Path(__file__).resolve().parent
source=repo/'11-delivery-continuation.py'
names={'safe_failure_events','run_live_command','stop'}
tree=ast.parse(source.read_text()); helpers=ast.Module(body=[x for x in tree.body if isinstance(x,ast.FunctionDef) and x.name in names],type_ignores=[])
tz=timezone(timedelta(hours=8)); date='2026-11-27'
ns=dict(Path=Path,datetime=datetime,json=json,os=os,signal=signal,subprocess=subprocess,contextlib=contextlib,date=date,now=lambda:datetime.now(tz))
exec(compile(helpers,str(source),'exec'),ns)
checks=0
with tempfile.TemporaryDirectory() as raw:
 root=Path(raw); journal=root/'journal';start=datetime.now(tz)-timedelta(seconds=1)
 current=dict(date=date,mode='live',checked_at=datetime.now(tz).isoformat(),stage='source_check',status='FAILED',attempt=1,code='CHECK_FAILED',raw='FAKE_PRIVATE',source_failures=[{'index':0,'code':'VISIBLE_DATE_MISMATCH','url':'https://private.example'},{'index':1,'code':'EVIL_PRIVATE'}])
 journal.write_text('\n'.join(map(json.dumps,[[],dict(current,date='2026-11-25'),dict(current,mode='dry_run'),dict(current,checked_at=(start-timedelta(seconds=1)).isoformat()),current]))+'\nnot json\n')
 events=ns['safe_failure_events'](journal,start);assert len(events)==1 and events[0]['source_failures']==[{'index':0,'code':'VISIBLE_DATE_MISMATCH'}]; assert 'PRIVATE' not in json.dumps(events) and 'url' not in json.dumps(events);checks+=1
 # stop has real temp archive/memory and projected state, never actual repository paths.
 arc=root/'archive';arc.mkdir();(arc/'08-verification.json').write_text('{"dry_run":"PASS"}')
 logs=root/'logs/automation';logs.mkdir(parents=True);(logs/('.crossborder-v4-dispatch-'+date+'.jsonl')).write_bytes(journal.read_bytes());memory=root/'memory';memory.write_text('')
 def write(p,d):p.write_text(json.dumps(d))
 statuses=[]; ns.update(archive=arc,memory=memory,write=write,record=statuses.append,stamp=lambda:datetime.now(tz).isoformat(),event_key='crossborder-v4-group-'+date,group='跨境咨询每日内容',sys=sys)
 prior=Path.cwd();os.chdir(root)
 try:
  for state in [None,'ATTEMPTED']:
   try:ns['stop']('fixed failure',state,start)
   except SystemExit as e:assert e.code==3
   receipt=json.loads((arc/'07-delivery.json').read_text());assert receipt['status']==('BLOCKED_PRE_SEND' if state is None else 'ATTEMPTED_UNCONFIRMED'); assert receipt['failure_stage']=='source_check' and receipt['failure_code']=='CHECK_FAILED'; assert receipt['automatic_resend'] is False; assert json.loads((arc/'08-verification.json').read_text())['delivery_failure']==receipt; checks+=1
  # Execute the real caller try/except AST with a nonexistent harmless command.
  caller=next(n for n in ast.walk(tree) if isinstance(n,ast.Try) and any(isinstance(h.type,ast.Name) and h.type.id=="OSError" for h in n.handlers) and any(isinstance(x,ast.Call) and isinstance(x.func,ast.Name) and x.func.id=="run_live_command" for x in ast.walk(n)))
  real_runner=ns['run_live_command']
  ns.update(state=lambda:{},dispatch_started=start)
  ns['run_live_command']=lambda command:real_runner([str(root/'no-such-command')])
  try:exec(compile(ast.Module(body=[caller],type_ignores=[]),str(source),'exec'),ns)
  except SystemExit as e:assert e.code==3
  receipt=json.loads((arc/'07-delivery.json').read_text());assert receipt['status']=='BLOCKED_PRE_SEND' and '无法启动' in receipt['reason']; assert 'no-such-command' not in json.dumps(receipt); checks+=1
  ns['run_live_command']=real_runner
 finally:os.chdir(prior)
 assert 'FAKE_PRIVATE' not in memory.read_text();checks+=1
 # Real harmless process tree, bounded timeout. The child cannot invoke npm or dws.
 pidfile=root/'childpid'; child='import subprocess,sys,time;from pathlib import Path;p=subprocess.Popen([sys.executable,"-c","import time; time.sleep(60)"]);Path(sys.argv[1]).write_text(str(p.pid));time.sleep(60)'
 began=time.monotonic()
 try:ns['run_live_command']([sys.executable,'-c',child,str(pidfile)],timeout=.4);raise AssertionError('expected timeout')
 except subprocess.TimeoutExpired:pass
 assert time.monotonic()-began<12
 childpid=int(pidfile.read_text()); alive=False
 for _ in range(30):
  p=subprocess.run(['ps','-o','stat=','-p',str(childpid)],capture_output=True,text=True)
  alive=p.returncode==0 and bool(p.stdout.strip()) and not p.stdout.strip().startswith('Z')
  if not alive:break
  time.sleep(.1)
 assert not alive,'live child survived timeout';checks+=1
 # Inspect the single live call count: helper definition does not invoke sender.
 script=source.read_text();assert script.count('result=run_live_command(["npm","run","crossborder:v2:dispatch"')==1;checks+=1
print(json.dumps({'status':'PASS','checks':checks,'real_harmless_process_tree':True,'external_send':False}))
