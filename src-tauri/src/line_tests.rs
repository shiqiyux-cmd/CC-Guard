// [INPUT]: 临时设置文件、本机假 controller/专用入站、手写线路检查结果与不会真正启动程序的启动闭包。
// [OUTPUT]: 设置读写/校验、secret 不外泄、启动门禁只在「通过」时启动、CLI 子进程只注入专用端口的回归。
// [POS]: line.rs 的纯逻辑单测；不连网、不启动程序、不碰真实 %APPDATA%。
// [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
use super::*;
use std::cell::Cell;

fn temp(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("cc-guard-line-{name}-{}", crate::identities::new_id().unwrap()));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}
fn patch(json: serde_json::Value) -> Result<SettingsPatch, serde_json::Error> {
    serde_json::from_value(json)
}
fn checked(verdict: Verdict) -> Outcome {
    let mut result = mihomo::unconfirmed("样本".into());
    result.verdict = verdict;
    result.timezone = "Asia/Tokyo".into();
    result
}

#[test]
fn defaults_follow_the_decisions() {
    let stored = Stored::default();
    assert_eq!(stored.line.claude_hosts, ["anthropic.com", "claude.ai", "claude.com"]);
    assert_eq!(stored.line.claude_processes, ["claude.exe"]);
    assert_eq!(stored.line.services, LINE_SERVICES);
    assert_eq!((stored.line.port, stored.line.controller.as_str()), (0, ""));
}

#[test]
fn secret_is_stored_but_never_returned() {
    let dir = temp("secret");
    let stored = apply(Stored::default(), patch(serde_json::json!({"line": {"secret": "top-secret-value", "port": 7899}})).unwrap()).unwrap();
    save_to(&dir, &stored).unwrap();
    let again = load_from(&dir).unwrap();
    assert_eq!(again.line.secret, "top-secret-value");
    let shown = serde_json::to_string(&view(&again, &dir)).unwrap();
    assert!(!shown.contains("top-secret-value") && !shown.contains("\"secret\""), "{shown}");
    assert!(shown.contains("\"secret_set\":true"));
    // 不带 secret 的补丁不清掉已存的 secret
    let kept = apply(again, patch(serde_json::json!({"line": {"node": "A"}})).unwrap()).unwrap();
    assert_eq!(kept.line.secret, "top-secret-value");
    let changed = apply(kept, patch(serde_json::json!({"line": {"controller": "127.0.0.1:1"}})).unwrap()).unwrap();
    assert!(changed.line.secret.is_empty());
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn rotating_an_expired_exit_checks_the_draft_and_commits_only_a_verified_replacement() {
    use serde_json::json;
    use std::{io::{Read, Write}, net::TcpListener};
    // 只接收本地测试请求。专用入站模拟两个独立域名，不需要 DNS 或公网。
    fn serve(bodies: Vec<String>) -> (u16, std::thread::JoinHandle<()>) {
        let socket = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = socket.local_addr().unwrap().port();
        let worker = std::thread::spawn(move || {
            for body in bodies {
                let (mut stream, _) = socket.accept().unwrap();
                stream.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
                let mut head = [0; 4096];
                assert!(stream.read(&mut head).unwrap() > 0);
                assert!(head.starts_with(b"GET "));
                write!(stream, "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
            }
        });
        (port, worker)
    }

    let dir = temp("replace");
    let old = apply(Stored::default(), patch(json!({"line": {
        "controller":"127.0.0.1:1", "port":1, "node":"expired", "expected_ip":"192.0.2.1"
    }})).unwrap()).unwrap();
    save_to(&dir, &old).unwrap();
    let state = Line::default();
    let write = |patch| tauri::async_runtime::block_on(write_settings(&dir, &state, patch));
    assert!(write(patch(json!({"line":{"expected_ip":""}})).unwrap()).is_err());

    let configs = json!({"mode":"rule","port":0,"socks-port":0,"mixed-port":0,"redir-port":0,"tproxy-port":0});
    let (controller, api) = serve(vec![configs.to_string(); 5]);
    let new_ip = "198.51.100.5";
    let renewed_ip = "198.51.100.6";
    let samples = [new_ip, new_ip, new_ip, renewed_ip, new_ip, new_ip, renewed_ip, renewed_ip, renewed_ip, renewed_ip]
        .map(|ip| json!({"ip":ip,"country_code":"JP"}).to_string());
    let (port, proxy) = serve(samples.to_vec());
    let draft = |expected: &str| patch(json!({"line":{
        "controller":format!("127.0.0.1:{controller}"), "port":port, "node":"replacement",
        "expected_ip":expected, "services":["http://svc1.test/","http://svc2.test/"]
    }})).unwrap();

    let preview = tauri::async_runtime::block_on(check_snapshot(&dir, &old, Some(draft("")))).unwrap();
    assert_eq!((preview.verdict, preview.ip.as_str()), (Verdict::Unknown, new_ip));
    assert_eq!(load_from(&dir).unwrap(), old);
    // 预览之后实际结果出现分歧：保留整个旧配置（包括原端口）。
    assert!(write(draft(new_ip)).is_err());
    assert_eq!(load_from(&dir).unwrap(), old);
    // 不必先恢复已失效的旧线路；新端口、节点、IP 一起生效。
    let saved = write(draft(new_ip)).unwrap();
    assert_eq!(load_from(&dir).unwrap(), saved);
    assert_eq!((saved.line.port, saved.line.node.as_str(), saved.line.expected_ip.as_str()), (port, "replacement", new_ip));
    // 同一入站换供应商出口时，普通检查继续拦住；用户确认后才替换原 IP。
    let changed = tauri::async_runtime::block_on(check_snapshot(&dir, &saved, None)).unwrap();
    assert_eq!((changed.verdict, changed.ip.as_str()), (Verdict::Block, renewed_ip));
    assert_eq!(load_from(&dir).unwrap(), saved);
    let renewed = write(patch(json!({"line":{"expected_ip":renewed_ip}})).unwrap()).unwrap();
    assert_eq!((renewed.line.port, renewed.line.expected_ip.as_str()), (port, renewed_ip));
    assert_eq!(load_from(&dir).unwrap(), renewed);
    // 已被替换的设置快照不得再给界面或托盘一个旧结论。
    let stale = tauri::async_runtime::block_on(check_snapshot(&dir, &saved, Some(patch(json!({"line":{"port":0}})).unwrap())));
    assert!(stale.unwrap_err().contains("已更改"));
    api.join().unwrap();
    proxy.join().unwrap();
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn workspace_cannot_be_patched_and_bad_values_are_refused() {
    assert!(patch(serde_json::json!({"workspace": "C:\\"})).is_err());
    assert!(patch(serde_json::json!({"line": {"secret_set": true}})).is_err());
    assert!(patch(serde_json::json!({"line": {"port": 70000}})).is_err());
    for bad in [
        serde_json::json!({"line": {"controller": "ftp://127.0.0.1:1"}}),
        serde_json::json!({"line": {"expected_ip": "not-an-ip"}}),
        serde_json::json!({"line": {"services": ["https://ipwho.is/", "nope"]}}),
        serde_json::json!({"line": {"claude_hosts": ["claude.ai", "bad host"]}}),
        serde_json::json!({"line": {"claude_processes": ["C:\\x\\claude.exe"]}}),
        serde_json::json!({"line": {"node": "A\nB"}}),
    ] {
        assert!(apply(Stored::default(), patch(bad.clone()).unwrap()).is_err(), "{bad}");
    }
    let ok = apply(
        Stored::default(),
        patch(serde_json::json!({"line": {"controller": " 127.0.0.1:9097 ", "claude_hosts": ["Claude.AI", "claude.ai", ".anthropic.com"], "expected_ip": ""}})).unwrap(),
    )
    .unwrap();
    assert_eq!(ok.line.controller, "127.0.0.1:9097");
    assert_eq!(ok.line.claude_hosts, ["claude.ai", "anthropic.com"]);
}

#[test]
fn corrupt_settings_are_reported_not_replaced() {
    let dir = temp("corrupt");
    std::fs::write(dir.join("settings.json"), b"{not json").unwrap();
    assert!(load_from(&dir).is_err());
    assert_eq!(std::fs::read(dir.join("settings.json")).unwrap(), b"{not json");
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn launch_starts_only_after_a_passing_check() {
    for verdict in [Verdict::Block, Verdict::Unknown] {
        let started = Cell::new(false);
        let result = decide_launch(checked(verdict), 7899, |_| {
            started.set(true);
            Ok(())
        })
        .unwrap();
        assert!(!started.get(), "{verdict:?} 不许启动");
        assert!(!result.launched);
        assert_eq!(result.check.verdict, verdict);
        assert!(!result.reason.is_empty());
    }
    // 端口没设也不许启动，哪怕检查结果是通过
    let started = Cell::new(false);
    assert!(!decide_launch(checked(Verdict::Pass), 0, |_| { started.set(true); Ok(()) }).unwrap().launched);
    assert!(!started.get());

    let seen = Cell::new(String::new());
    let result = decide_launch(checked(Verdict::Pass), 7899, |gate| {
        seen.set(format!("{} {}", gate.endpoint, gate.check.timezone));
        Ok(())
    })
    .unwrap();
    assert!(result.launched);
    assert_eq!(seen.take(), "http://127.0.0.1:7899 Asia/Tokyo");
    // 启动本身失败如实报错，不报已启动
    assert!(decide_launch(checked(Verdict::Pass), 7899, |_| Err("坏了".into())).is_err());
}

#[test]
fn cli_child_gets_only_the_dedicated_port() {
    let dir = temp("cli");
    let command = cli_command(&dir, "http://127.0.0.1:7899");
    let envs: Vec<(String, Option<String>)> = command
        .get_envs()
        .map(|(k, v)| (k.to_string_lossy().into_owned(), v.map(|v| v.to_string_lossy().into_owned())))
        .collect();
    let value = |key: &str| envs.iter().find(|(k, _)| k == key).map(|(_, v)| v.clone());
    assert_eq!(value("HTTP_PROXY"), Some(Some("http://127.0.0.1:7899".into())));
    assert_eq!(value("HTTPS_PROXY"), Some(Some("http://127.0.0.1:7899".into())));
    assert_eq!(value("NO_PROXY"), Some(Some("localhost,127.0.0.1".into())));
    assert_eq!(value("ALL_PROXY"), Some(None));
    assert_eq!(envs.len(), 4, "{envs:?}");
    assert_eq!(command.get_current_dir(), Some(dir.as_path()));
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn stale_default_services_upgrade_but_custom_lists_stay() {
    let dir = temp("services");
    let mut old = Stored::default();
    old.line.services = crate::browser::network::SERVICES.iter().map(|s| s.to_string()).collect();
    save_to(&dir, &old).unwrap();
    assert_eq!(load_from(&dir).unwrap().line.services, LINE_SERVICES);
    old.line.services = vec!["https://a.test/".into(), "https://b.test/".into()];
    save_to(&dir, &old).unwrap();
    assert_eq!(load_from(&dir).unwrap().line.services, ["https://a.test/", "https://b.test/"]);
}

#[test]
fn desktop_starts_through_the_alias_pinned_to_the_dedicated_port() {
    let command = desktop_command(Path::new(r"C:\fake\claude-desktop.exe"), "http://127.0.0.1:17892");
    assert_eq!(command.get_program(), r"C:\fake\claude-desktop.exe");
    let args: Vec<_> = command.get_args().map(|a| a.to_string_lossy().into_owned()).collect();
    assert_eq!(args, ["--proxy-server=http://127.0.0.1:17892"]);
}
