"""Compare fresh HTTPS requests through the ordinary and Claude-specific local listeners."""
import concurrent.futures
import http.client
import ipaddress
import json
import os
from pathlib import Path
import secrets
import sys
import time
import urllib.parse


def controller(settings):
    address = settings["controller"]
    url = urllib.parse.urlsplit(address if "://" in address else "http://" + address)
    if url.scheme not in ("http", "https") or url.hostname not in ("127.0.0.1", "::1", "localhost"):
        raise ValueError("请检查 CC-Guard 的本机控制地址。")
    connection = http.client.HTTPSConnection if url.scheme == "https" else http.client.HTTPConnection

    def get(path):
        ctrl = connection(url.hostname, url.port, timeout=5)
        try:
            headers = {"Authorization": "Bearer " + settings["secret"]} if settings.get("secret") else {}
            ctrl.request("GET", path, headers=headers)
            result = ctrl.getresponse()
            if result.status != 200:
                raise ValueError(f"Clash 控制接口返回 HTTP {result.status}。")
            return json.load(result)
        finally:
            ctrl.close()
    return get


def chain(row):
    return " → ".join(reversed(row.get("chains") or []))


def rule(row):
    return " ".join(filter(None, (row.get("rule"), row.get("rulePayload"))))


def decision(row, mode):
    if not row:
        return "未捕获匹配记录"
    if group := row.get("metadata", {}).get("specialProxy"):
        return f"入口指定 {group}"
    if row.get("rule") == "Match":
        return "MATCH 兜底规则"
    labels = {"ProcessName": "进程规则", "DomainSuffix": "域名后缀", "Domain": "域名"}
    if row.get("rule") in labels and row.get("rulePayload"):
        return f"{labels[row['rule']]} {row['rulePayload']}"
    if matched := rule(row):
        return matched
    if mode == "global" and "GLOBAL" in (row.get("chains") or []):
        return "全局选择 GLOBAL"
    if mode == "direct" and "DIRECT" in (row.get("chains") or []):
        return "直连模式"
    return "内核未报告匹配规则"


def measure(port, host, path, get):
    started = time.perf_counter()
    conn = http.client.HTTPSConnection("127.0.0.1", port, timeout=8)
    row = {}
    try:
        conn.set_tunnel(host, 443)
        conn.connect()
        source_port = str(conn.sock.getsockname()[1])
        try:
            for candidate in get("/connections").get("connections") or []:
                meta = candidate.get("metadata", {})
                if str(meta.get("sourcePort")) == source_port and meta.get("host") == host:
                    row = candidate
                    break
        except (OSError, http.client.HTTPException, ValueError):
            pass
        conn.request("GET", path + "?ccguard=" + secrets.token_hex(6),
                     headers={"Host": host, "User-Agent": "curl/8", "Cache-Control": "no-cache"})
        result = conn.getresponse()
        ip = f"HTTP {result.status}"
        if result.status == 200:
            body = result.read(4096).decode("utf-8", "replace").strip()
            if host == "www.cloudflare.com":
                body = dict(s.split("=", 1) for s in body.splitlines() if "=" in s).get("ip", "")
            try:
                ip = str(ipaddress.ip_address(body))
            except ValueError:
                ip = "网站未返回可识别的 IP"
    except (OSError, http.client.HTTPException):
        ip = "没有取得出口（连接失败或超时）"
    finally:
        conn.close()
    return ip, row, round((time.perf_counter() - started) * 1000)


def probe(port, host, path, get):
    # The local rotation tool consumes this three-field result.
    ip, row, _ = measure(port, host, path, get)
    return ip, chain(row), rule(row)


def first_hop(get, proxies, leaf, provider):
    node = proxies.get(leaf, {})
    if provider:
        members = get("/providers/proxies/" + urllib.parse.quote(provider, safe="")).get("proxies", [])
        node = next((item for item in members if item.get("name") == leaf), {})
    hop = node.get("dialer-proxy")
    names = []
    while hop and hop not in names:
        names.append(hop)
        hop = proxies.get(hop, {}).get("now")
    return " → ".join(names)


def main():
    settings = Path(os.environ["APPDATA"]) / "io.github.shiqiyux-cmd.cc-guard" / "settings.json"
    line = json.loads(settings.read_text(encoding="utf-8-sig"))["line"]
    get = controller(line)
    cfg = get("/configs")
    daily = cfg.get("mixed-port") or cfg.get("port")
    if not daily or not line.get("port") or daily == line["port"]:
        raise ValueError("无法区分日常 HTTP 入口和 Claude 专用入口，请检查设置。")
    mode = cfg["mode"].lower()
    mode_name = {"rule": "规则模式（按顺序匹配）", "global": "全局模式", "direct": "直连模式"}.get(mode, mode)
    print(f"Clash 当前为{mode_name}，TUN {'开' if (cfg.get('tun') or {}).get('enable') else '关'}。")
    print("每个网站各新建一次连接。耗时从本机发起查询到读完 IP，包含建立连接和网站响应。")
    sites = [("Ping0", "ping0.cc", "/"), ("Cloudflare", "www.cloudflare.com", "/cdn-cgi/trace"),
             ("ipify（IPv4）", "api.ipify.org", "/")]
    entries = [("Clash 日常入口", daily), ("Claude 专线", line["port"])]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        jobs = {(port, name): pool.submit(measure, port, host, path, get)
                for _, port in entries for name, host, path in sites}
    try:
        proxies = get("/proxies")["proxies"]
    except (KeyError, OSError, ValueError, http.client.HTTPException):
        proxies = {}
    for entry, port in entries:
        print(f"\n【{entry}  127.0.0.1:{port}】")
        routes = {}
        for name, _, _ in sites:
            ip, row, elapsed = jobs[port, name].result()
            print(f"  {name}  {ip}  （{elapsed} ms）")
            leaf = next(iter(row.get("chains") or []), "")
            provider = next(iter(row.get("providerChains") or []), "")
            routes.setdefault((decision(row, mode), chain(row), leaf, provider), []).append(name)
        for (reason, route, leaf, provider), names in routes.items():
            print(f"  {'、'.join(names)}  |  {reason}  |  {route or '未读到代理链'}")
            try:
                front = first_hop(get, proxies, leaf, provider)
            except (OSError, ValueError, http.client.HTTPException):
                print("  前置节点信息未读到。")
            else:
                if front:
                    print(f"  出站顺序（前置组当前选择）  {front} → {leaf}")
    print("  CC-Guard 保存的期望 IP", line.get("expected_ip") or "未设置")
    try:
        rows = get("/connections").get("connections") or []
    except (OSError, ValueError, http.client.HTTPException):
        return
    observed = set()
    for row in rows:
        meta = row.get("metadata", {})
        name = meta.get("process") or Path(meta.get("processPath") or "").name
        if not name and row.get("rule") == "ProcessName":
            name = row.get("rulePayload") or ""
        if name.lower() in ("codex.exe", "chatgpt.exe", "claude.exe"):
            observed.add((name.lower(), str(meta.get("inboundPort") or "?"), decision(row, mode), chain(row)))
    if observed:
        print("\n【当前仍在连接的应用】")
        for name, port, reason, route in sorted(observed):
            print(f"  {name}  :{port}  |  {reason}  |  {route or '未读到代理链'}")


if __name__ == "__main__":
    try:
        main()
    except (KeyError, ValueError, OSError, http.client.HTTPException) as error:
        print("检查未完成。", str(error) if isinstance(error, ValueError) else type(error).__name__)
        sys.exit(1)
