# coding: utf-8
from pathlib import Path
from datetime import datetime,timedelta,timezone
import json,subprocess,sys,time,re,hashlib

repo=Path('/Users/oldking/Documents/ChatGPT/YQN 晨报内容')
archive=repo/'data/codex-shadow/2026-11-18.crossborder-v4'
base=sys.argv[1]
assert re.fullmatch('[0-9a-f]{40}',base)
expected_remote='https://github.com/zherong0603-web/yqn-daily-intelligence-portal.git'
pointer=json.loads((repo/'logs/automation/.yqn-2026-11-18-continuation').read_text())
status=Path(pointer['status_file'])
output=status.with_name('git-finalize.json')
tz=timezone(timedelta(hours=8))
def record(value):
    output.write_text(json.dumps(dict(date='2026-11-18',checked_at=datetime.now(tz).isoformat(timespec='seconds'),**value),ensure_ascii=False,indent=2)+'\n')
def stop(reason):
    record({'status':'STOPPED_WITHOUT_PUSH','reason':reason})
    sys.exit(1)
def run(args,timeout=90):
    return subprocess.run(args,cwd=repo,capture_output=True,text=True,timeout=timeout)
def guard(expected_head):
    if run(['git','rev-parse','HEAD']).stdout.strip()!=expected_head:stop('HEAD changed')
    if run(['git','symbolic-ref','--quiet','HEAD']).stdout.strip()!='refs/heads/main':stop('branch changed')
    if run(['git','remote','get-url','origin']).stdout.strip()!=expected_remote:stop('remote changed')
    if run(['git','remote','get-url','--push','origin']).stdout.strip()!=expected_remote:stop('push remote changed')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

while datetime.now(tz).strftime('%Y-%m-%d')=='2026-11-18':
    current=json.loads(status.read_text())
    if current.get('status')=='DELIVERED':break
    if current.get('status') in ('BLOCKED','SKIPPED_DELIVERED'):
        record({'status':'STOPPED_WITHOUT_NEW_COMMIT','delivery_status':current['status']})
        sys.exit(0)
    time.sleep(20)
else:
    stop('date expired')

guard(base)
receipt=json.loads((archive/'07-delivery.json').read_text())
if receipt.get('status')!='DELIVERED' or receipt.get('idempotency_key')!='crossborder-v4-group-2026-11-18' or receipt.get('target')!='跨境咨询每日内容':stop('invalid receipt')
files=[str(p.relative_to(repo)) for p in [archive/'07-delivery.json',archive/'08-verification.json',archive/'10-delivery-check.json',archive/'2026-11-18.crossborder-v2.review.json',archive/'2026-11-18.source-checks.json',repo/'data/codex-shadow/2026-11-18.crossborder-v2.review.json',repo/'data/codex-shadow/2026-11-18.source-checks.json']]
hashes=current.get('archive_sha256',{})
if set(hashes)!=set(files):stop('missing sender hash manifest')
for name in files:
    if sha(repo/name)!=hashes[name]:stop('receipt file changed after sender wrote it')
    content=(repo/name).read_text()
    if re.search(r'AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{25,}|"(?:userId|robotCode|AppSecret|accessToken)"\s*:',content):stop('content scan blocked')
if run(['git','diff','--cached','--quiet','--',*files]).returncode:stop('receipt paths already staged')
guard(base)
for name in files:
    if run(['git','ls-files','--error-unmatch','--',name]).returncode:
        if name!='data/codex-shadow/2026-11-18.crossborder-v4/10-delivery-check.json':stop('unexpected untracked file')
        if run(['git','add','--intent-to-add','--',name]).returncode:stop('could not register new receipt path')
if any(sha(repo/name)!=hashes[name] for name in files):stop('receipt files changed before commit')
commit=run(['git','commit','--only','-m','Record Nov 18 verified DingTalk group delivery','--',*files])
if commit.returncode:stop('commit failed')
head=run(['git','rev-parse','HEAD']).stdout.strip()
guard(head)
parents=run(['git','rev-list','--parents','-n','1',head]).stdout.strip().split()
if parents!=[head,base]:stop('commit parent mismatch')
for name in files:
    blob=subprocess.run(['git','show',head+':'+name],cwd=repo,capture_output=True,timeout=15)
    if blob.returncode or hashlib.sha256(blob.stdout).hexdigest()!=hashes[name]:stop('committed receipt hash mismatch')
try:
    before=run(['git','ls-remote','origin','refs/heads/main'],45)
    if before.returncode or not before.stdout.split() or before.stdout.split()[0]!=base:stop('remote branch changed')
    guard(head)
    pushed=run(['git','push','origin',head+':refs/heads/main'],120)
    remote=run(['git','ls-remote','origin','refs/heads/main'],45)
    matches=remote.returncode==0 and bool(remote.stdout.split()) and remote.stdout.split()[0]==head
    record({'status':'PUSHED' if pushed.returncode==0 and matches else 'LOCAL_COMMIT_PUSH_UNCONFIRMED','commit':head,'remote_verified':matches})
except subprocess.TimeoutExpired:
    record({'status':'LOCAL_COMMIT_PUSH_TIMEOUT','commit':head})
