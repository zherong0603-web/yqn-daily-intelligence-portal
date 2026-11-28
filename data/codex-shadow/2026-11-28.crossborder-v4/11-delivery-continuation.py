#!/usr/bin/env python3
# coding: utf-8
"""One-shot continuation of the current, already approved heartbeat dry run."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import contextlib, fcntl, hashlib, json, os, re, signal, subprocess, sys, time

date = "2026-11-28"
tz = timezone(timedelta(hours=8))
due = datetime.fromisoformat(date+"T16:00:00+08:00")
expiry = datetime.fromisoformat(date+"T23:59:59+08:00")
root = Path("data/codex-shadow")
archive = root/(date+".crossborder-v4")
memory = Path("logs/automation/yqn-2.md")
statefile = Path("logs/automation/.crossborder-v4-dws-group-state.json")
status_file = Path(sys.argv[1])
event_key = "crossborder-v4-group-"+date
success = {"DELIVERED","READ","UNREAD"}
group = "跨境咨询每日内容"
pattern = r"\[crossborder-v4:dws-group-delivered\] date="+date+r" status=(DELIVERED|READ|UNREAD)\b"

def now():
    return datetime.now(tz)
def stamp():
    return now().isoformat(timespec="seconds")
def write(file,data):
    tmp=file.with_name(file.name+".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2)+"\n")
    tmp.replace(file)
def record(data):
    write(status_file,dict(date=date,checked_at=stamp(),**data))
    print(json.dumps(data,ensure_ascii=False),flush=True)
def safe_failure_events(journal_file, started_at):
    stages={"build","source_check","artifacts","authentication","group_lookup","pre_send_budget","send","delivery_receipt"}
    statuses={"STARTED","PASSED","RETRYING","FAILED"}
    codes={"ECONNRESET","ECONNREFUSED","ETIMEDOUT","EAI_AGAIN","ENOTFOUND","NETWORK_TRANSIENT","BUDGET_EXHAUSTED","CHECK_FAILED"}
    source_codes={"VISIBLE_DATE_MISMATCH","EVIDENCE_MARKER_MISSING","NETWORK_TRANSIENT","TIMEOUT","HTTP_TRANSIENT","SOURCE_CHECK_FAILED"}
    events=[]
    if not journal_file.exists():return events
    for line in journal_file.read_text().splitlines():
        try:
            item=json.loads(line)
            if not isinstance(item,dict):continue
            when=datetime.fromisoformat(str(item.get("checked_at","")).replace("Z","+00:00"))
            if item.get("date")!=date or item.get("mode")!="live" or when<started_at or when>now() or item.get("stage") not in stages or item.get("status") not in statuses:continue
            attempt=item.get("attempt")
            if type(attempt) is not int or not 1<=attempt<=3:continue
            event={"checked_at":when.isoformat(),"stage":item["stage"],"status":item["status"],"attempt":attempt}
            if item.get("code") in codes:event["code"]=item["code"]
            failures=item.get("source_failures",[])
            if isinstance(failures,list):
                event["source_failures"]=[{"index":f["index"],"code":f["code"]} for f in failures if isinstance(f,dict) and type(f.get("index")) is int and 0<=f["index"]<100 and f.get("code") in source_codes]
            events.append(event)
        except (ValueError,TypeError):continue
    return events

def run_live_command(command, timeout=360):
    # A process group belongs only to this one approved dispatch. Reap it on timeout.
    proc=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True)
    try:
        stdout,stderr=proc.communicate(timeout=timeout)
        return subprocess.CompletedProcess(command,proc.returncode,stdout,stderr)
    except subprocess.TimeoutExpired:
        with contextlib.suppress(ProcessLookupError):os.killpg(proc.pid,signal.SIGTERM)
        try:proc.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            with contextlib.suppress(ProcessLookupError):os.killpg(proc.pid,signal.SIGKILL)
            proc.communicate(timeout=5)
        with contextlib.suppress(ProcessLookupError):os.killpg(proc.pid,signal.SIGKILL)
        proc.wait(timeout=5)
        raise

def stop(reason, attempt_state=None, dispatch_started=None):
    events=safe_failure_events(Path("logs/automation/.crossborder-v4-dispatch-"+date+".jsonl"),dispatch_started) if dispatch_started else []
    last=next((e for e in reversed(events) if e["status"]=="FAILED"),None)
    evidence={"failure_stage":last["stage"] if last else "UNKNOWN", "failure_code":last.get("code","CHECK_FAILED") if last else "UNKNOWN", "source_failures":last.get("source_failures",[]) if last else [], "stage_events":events}
    status="ATTEMPTED_UNCONFIRMED" if attempt_state=="ATTEMPTED" else "BLOCKED_PRE_SEND" if not attempt_state else "BLOCKED"
    delivery={"date":date,"checked_at":stamp(),"status":status,"reason":reason,"attempt_state":attempt_state,"idempotency_key":event_key,"target":group,"automatic_resend":False,**evidence}
    write(archive/"07-delivery.json",delivery)
    checks_file=archive/"08-verification.json"
    if checks_file.exists():
        checks=json.loads(checks_file.read_text());checks.update(delivery_status=status,delivery_failure=delivery);write(checks_file,checks)
    record({"status":"BLOCKED", "reason":reason, "attempt_state":attempt_state, **evidence})
    with memory.open("a") as f:
        f.write(f"\n- {stamp()} 本次群发执行阻塞：{reason}；stage={evidence['failure_stage']}，code={evidence['failure_code']}，source_indices={[x['index'] for x in evidence['source_failures']]}，attempt={attempt_state or 'NONE'}。07/08已回填；外层不重跑live，ATTEMPTED未核验禁止重试。\n")
    sys.exit(3)
def state():
    return json.loads(statefile.read_text()).get("dates",{}).get(date,{}) if statefile.exists() else {}
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def normalized(s):
    return re.sub(r"\s+", "", s)

def delivery_readback_window(attempted_at, delivered_at):
    started=datetime.fromisoformat(attempted_at.replace("Z","+00:00"))
    received=datetime.fromisoformat(delivered_at.replace("Z","+00:00"))
    if received < started:
        raise ValueError("Delivery receipt predates the attempt")
    return ((started-timedelta(seconds=2)).astimezone(tz),
            (received+timedelta(minutes=2)).astimezone(tz))

def matching_delivery_messages(messages, headings, body):
    """Match rendered Markdown title and complete approved body, without trusting CLI title echo."""
    names=[h.strip() for h in headings if isinstance(h,str) and h.strip()]
    if not names or not isinstance(body,str) or not body.strip():
        return []
    expected=normalized(body)
    return [m for m in messages if isinstance(m,dict) and isinstance(m.get("text"),str)
            and any(h in m["text"] for h in names) and expected in normalized(m["text"])]

def matched_delivery_units(markdown, seen, candidates):
    """Permit only DWS's observed list restart on complete known candidate lines."""
    units=[re.sub(r"^[#*\-\s]+", "", line).strip() for line in markdown.splitlines() if line.strip()]
    block=markdown.split("## 5条重点候选",1)[1].split("\n## ",1)[0] if "## 5条重点候选" in markdown else ""
    allowed=set()
    for line in block.splitlines():
        unit=re.sub(r"^[#*\-\s]+", "", line).strip()
        if not re.match(r"^[1-5]\.\s+",unit):continue
        matches=[c for c in candidates if normalized(c["title"]) in normalized(unit) and normalized(c["reason"]) in normalized(unit)]
        if len(matches)==1:allowed.add(unit)
    exact=0;rendered=0;changed=[]
    for unit in units:
        if normalized(unit) in seen:
            exact+=1;rendered+=1
        elif unit in allowed:
            alternative=re.sub(r"^[1-5]\.\s+","1. ",unit,count=1)
            if normalized(alternative) in seen:
                rendered+=1;changed.append(int(unit.split(".",1)[0]))
    return {"total":len(units),"matched":rendered,"strict_matched":exact,"candidate_ordinal_adjustments":changed}

with Path("logs/automation/.crossborder-v4-group-2026-11-28-continuation.lock").open("a") as lock:
    fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    freeze=json.loads((archive/"06-freeze.json").read_text())
    checks=json.loads((archive/"08-verification.json").read_text())
    if not freeze.get("on_time") or checks.get("dry_run")!="PASS" or not checks.get("source",{}).get("all_ok"):
        stop("未取得按时冻结、严格来源及无 live 干跑通过记录")
    reviews=checks.get("independent_reviews",[])
    if len(reviews)!=3 or {r.get("role") for r in reviews}!={"facts","action","copy"}:
        stop("缺少独立三审记录")
    for review in reviews:
        if review.get("status")!="PASS" or any(sha(archive/review[name])!=review[name+"_sha256"] for name in ("review_file","reviewed_file")):
            stop("独立审核未通过或所审版本发生变化")
    if now() >= expiry:
        stop("单次发稿窗口已结束")
    if state().get("status")=="DELIVERED" or re.search(pattern,memory.read_text().replace("`", "")):
        record({"status":"SKIPPED_DELIVERED"})
        sys.exit(0)
    if state().get("status")=="ATTEMPTED":
        stop("已有未核验尝试，不重试", "ATTEMPTED")
    try:
        cfg=Path(os.environ.get("CODEX_HOME",str(Path.home()/".codex")))/"automations/yqn-3/automation.toml"
        initial_cfg=sha(cfg)
    except OSError:
        stop("无法核对原自动化仍存在")
    record({"status":"WAITING_UNTIL_16_00","due_at":due.isoformat(),"frozen_at":freeze["frozen_at"],"dry_run":"PASS"})
    while now() < due:
        time.sleep(min(25,max(0.05,(due-now()).total_seconds())))
    if now() >= expiry:
        stop("恢复时已经超过单次发稿窗口")
    if not cfg.exists() or sha(cfg)!=initial_cfg:
        stop("当前排程任务设置有变动，未按旧配置发送")
    if state().get("status")=="DELIVERED" or re.search(pattern,memory.read_text().replace("`", "")):
        record({"status":"SKIPPED_DELIVERED"})
        sys.exit(0)
    if state().get("status")=="ATTEMPTED":
        stop("临发送前已有未核验尝试，不重试", "ATTEMPTED")
    if (any(sha(x)!=freeze["delivery_sha256"] for x in (archive/"06-final.md",archive/"06-delivery.md",root/(date+".crossborder-v2.md")))
        or sha(root/(date+".crossborder-v2.json"))!=checks["input_sha256"]
        or sha(archive/freeze["reviewed_version"])!=freeze["reviewed_sha256"]):
        stop("冻结文件或已审核输入在干跑后发生变化，未发送")
    for review in reviews:
        if any(sha(archive/review[name])!=review[name+"_sha256"] for name in ("review_file","reviewed_file")):
            stop("等待期间审核文件或审核版本发生变化")
    dispatch_started=now()
    try:
        result=run_live_command(["npm","run","crossborder:v2:dispatch","--","--date",date,"--live"])
    except subprocess.TimeoutExpired:
        stop("正式命令超时，已终止并回收本次进程组；保留本机状态，不重试",state().get("status"),dispatch_started)
    except OSError:
        stop("正式命令无法启动，未读取异常原文；核对本机状态后停止，不重试",state().get("status"),dispatch_started)
    after=state()
    marker=re.search(pattern,result.stdout)
    if result.returncode or not marker or after.get("status")!="DELIVERED" or after.get("delivery_status") not in success or after.get("idempotency_key")!=event_key or after.get("target")!=group or not re.search(pattern,memory.read_text().replace("`", "")):
        stop("正式命令或送达核验未通过，详见白名单阶段证据",after.get("status"),dispatch_started)
    receipt={k:after[k] for k in ("status","delivery_status","attempted_at","delivered_at","idempotency_key","target")}
    receipt.update(date=date, frozen_at=freeze["frozen_at"], marker_verified=True, delivery_hash_verified=True)
    write(archive/"07-delivery.json",receipt)
    for suffix in (".crossborder-v2.json",".crossborder-v2.review.json",".source-checks.json",".heygen-a.txt",".heygen-b.txt",".heygen.txt"):
        name=date+suffix
        (archive/name).write_bytes((root/name).read_bytes())
    title_line=json.loads((root/(date+".crossborder-v2.json")).read_text())
    begin,end=delivery_readback_window(after["attempted_at"],after["delivered_at"])
    query=['dws','chat','+chat-messages','--group',group,'--start',begin.isoformat(timespec="seconds"),'--end',end.isoformat(timespec="seconds"),'--page-all','--page-limit','5','--max-items','30','--no-reactions','-f','json','--jq','{complete,hasMore,messages: [.messages[]? | {text,createTime}]}']
    readback={"all_ok":False,"complete":False,"note":"群读回未取得完整精确匹配；已核验的送达回执有效，不补发"}
    # Read-only bounded verification, never rerun live. Project only message text and time.
    for pause in (0,5,12):
        if pause:
            time.sleep(pause)
        with contextlib.suppress(ValueError,OSError,subprocess.TimeoutExpired):
            rr=subprocess.run(query,capture_output=True,text=True,timeout=70)
            page=json.loads(rr.stdout) if rr.returncode==0 else {}
            title="跨境早知道 V4｜"+date
            messages=page.get("messages",[])
            headline=(archive/"06-delivery.md").read_text().splitlines()[0].lstrip("# ").strip()
            matches=matching_delivery_messages(messages,[title,title_line["title"],headline],title_line["voiceover_body"])
            seen=normalized(matches[0]["text"]) if len(matches)==1 else ""
            items=title_line["editorial"]["candidates"]
            nums=sum(normalized(c["title"]) in seen for c in items)
            para=title_line["voiceover_body"].split("\n\n")
            segments=sum(normalized(p) in seen for p in para)
            flags={"theme":normalized(title_line["editorial"]["theme"]) in seen,
                   "action_window":"行动窗口" in seen,"order_ledger":"预算经营账" in seen,
                   "hook_a":normalized(title_line["hooks"]["a"]) in seen,
                   "hook_b":normalized(title_line["hooks"]["b"]) in seen,
                   "source":"advertising.amazon.com/resources/whats-new/dynamic-budget-control" in seen}
            unit_check=matched_delivery_units((archive/"06-delivery.md").read_text(),seen,items)
            full_units=unit_check["matched"]
            flags["candidate_reasons"]=all(normalized(c["reason"]) in seen for c in items)
            flags["full_delivery_text"]=full_units==unit_check["total"]
            okay=(page.get("complete") is True and page.get("hasMore") is False and len(matches)==1 and
                  nums==len(items) and segments==len(para) and all(flags.values()))
            readback=dict(date=date,checked_at=stamp(),complete=page.get("complete") is True,
                has_more=page.get("hasMore"),unique_title_matches=len(matches),candidate_rows=nums,
                body_paragraphs_matched=segments,body_paragraphs_total=len(para),delivery_units_matched=full_units,delivery_units_total=unit_check["total"],strict_delivery_units_matched=unit_check["strict_matched"],candidate_ordinal_adjustments=unit_check["candidate_ordinal_adjustments"],all_ok=okay,**flags)
            if okay:
                break
    write(archive/"10-delivery-check.json",readback)
    checks.update(checked_at=stamp(), delivery_status=receipt["delivery_status"], readback_all_ok=readback["all_ok"])
    write(archive/"08-verification.json",checks)
    with memory.open("a") as f:
        f.write(f"\n- {stamp()} 2026-11-28 正刊：{title_line['editorial']['candidate_count_researched']}条去重候选，5条重点，72小时比较。美国SP广告既有预算规则核对，27日市场广告排期提醒作触发、2021-08-12官方规则文为事实底座，两官方help人工核操作。按活动逐条核规则状态/时段/账户时区/调整后日预算，对照批准计划；换商品不自动删规则，100加20%等于120是完全假设额度，不冒实际已多花或现金硬封顶。授权处理偏离规则并读回，符合计划先不动。独立三审PASS；A/B {checks['build']['estimated_seconds']['a']}/{checks['build']['estimated_seconds']['b']}秒；冻结{freeze['frozen_at']}；严格来源及完整干跑通过。仅向跨境咨询每日内容发送一次；{event_key}，{receipt['delivery_status']}，送达{receipt['delivered_at']}，精确标记匹配；群回读{'通过' if readback['all_ok'] else '未完整核验'}。\n")


    archive_paths=[archive/"07-delivery.json",archive/"08-verification.json",archive/"10-delivery-check.json",archive/(date+".crossborder-v2.review.json"),archive/(date+".source-checks.json"),root/(date+".crossborder-v2.review.json"),root/(date+".source-checks.json")]
    archive_hashes={str(p):sha(p) for p in archive_paths}
    record({"status":"DELIVERED","delivery_status":receipt["delivery_status"],"delivered_at":receipt["delivered_at"],"readback":readback["all_ok"],"archive_sha256":archive_hashes})
