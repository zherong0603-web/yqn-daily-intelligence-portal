#!/usr/bin/env python3
# coding: utf-8
"""One-shot continuation of the current, already approved heartbeat dry run."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import contextlib, fcntl, hashlib, json, os, re, subprocess, sys, time

date = "2026-11-22"
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
def stop(reason, attempt_state=None):
    record({"status":"BLOCKED", "reason":reason, "attempt_state":attempt_state})
    with memory.open("a") as f:
        f.write(f"\n- {stamp()} 本次群发执行阻塞：{reason}。已核对当日状态；不自动重试。\n")
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

with Path("logs/automation/.crossborder-v4-group-2026-11-22-continuation.lock").open("a") as lock:
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
    try:
        result=subprocess.run(["npm","run","crossborder:v2:dispatch","--","--date",date,"--live"],capture_output=True,text=True,timeout=360)
    except subprocess.TimeoutExpired:
        stop("正式命令超时，保留本机状态，不自动重试",state().get("status"))
    after=state()
    marker=re.search(pattern,result.stdout)
    if result.returncode or not marker or after.get("status")!="DELIVERED" or after.get("delivery_status") not in success or after.get("idempotency_key")!=event_key or after.get("target")!=group or not re.search(pattern,memory.read_text().replace("`", "")):
        err=(result.stderr+result.stdout).lower()
        reason="正式命令或送达标记未通过"
        if "authentication required" in err: reason="Workspace CLI 登录检查失败"
        elif "exactly one group" in err: reason="群名无法唯一解析"
        elif "source checks failed" in err: reason="live 前的严格来源复查失败"
        elif "unconfirmed" in err: reason="已尝试，未取得合格送达回执"
        stop(reason,after.get("status"))
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
                   "action_window":"行动窗口" in seen,"order_ledger":"报价经营账" in seen,
                   "hook_a":normalized(title_line["hooks"]["a"]) in seen,
                   "hook_b":normalized(title_line["hooks"]["b"]) in seen,
                   "source":"sell.amazon.com/blog/amazon-pricing-strategies" in seen}
            units=[re.sub(r"^[#*\-\s]+", "", line).strip() for line in (archive/"06-delivery.md").read_text().splitlines() if line.strip()]
            full_units=sum(normalized(unit) in seen for unit in units)
            flags["candidate_reasons"]=all(normalized(c["reason"]) in seen for c in items)
            flags["full_delivery_text"]=full_units==len(units)
            okay=(page.get("complete") is True and page.get("hasMore") is False and len(matches)==1 and
                  nums==len(items) and segments==len(para) and all(flags.values()))
            readback=dict(date=date,checked_at=stamp(),complete=page.get("complete") is True,
                has_more=page.get("hasMore"),unique_title_matches=len(matches),candidate_rows=nums,
                body_paragraphs_matched=segments,body_paragraphs_total=len(para),delivery_units_matched=full_units,delivery_units_total=len(units),all_ok=okay,**flags)
            if okay:
                break
    write(archive/"10-delivery-check.json",readback)
    checks.update(checked_at=stamp(), delivery_status=receipt["delivery_status"], readback_all_ok=readback["all_ok"])
    write(archive/"08-verification.json",checks)
    with memory.open("a") as f:
        f.write(f"\n- {stamp()} 2026-11-22 正刊：14条候选，5条重点，72小时检索。美国亚马逊黑五报价核查，先区分报价被停用、仍在售、是否当前精选报价。AMZ11月20日反馈仅触发排查，官方2024定价工具及2026精选报价指南支持操作；5%是部分定价机会范围，不是统一降幅或获得订单保证，不沿用旧卖家准入门槛。独立三审PASS；A/B {checks['build']['estimated_seconds']['a']}/{checks['build']['estimated_seconds']['b']}秒；冻结{freeze['frozen_at']}；严格来源及完整干跑通过。仅向跨境咨询每日内容发送一次；{event_key}，{receipt['delivery_status']}，送达{receipt['delivered_at']}，精确标记匹配；群回读{'通过' if readback['all_ok'] else '未完整核验'}。\n")

    archive_paths=[archive/"07-delivery.json",archive/"08-verification.json",archive/"10-delivery-check.json",archive/(date+".crossborder-v2.review.json"),archive/(date+".source-checks.json"),root/(date+".crossborder-v2.review.json"),root/(date+".source-checks.json")]
    archive_hashes={str(p):sha(p) for p in archive_paths}
    record({"status":"DELIVERED","delivery_status":receipt["delivery_status"],"delivered_at":receipt["delivered_at"],"readback":readback["all_ok"],"archive_sha256":archive_hashes})
