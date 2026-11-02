"""Verify file-provider rotation with an isolated mihomo and loopback-only exits."""

import json
import subprocess
import sys
import tempfile
import time
from contextlib import ExitStack
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from run import MIHOMO, SECRET, VERSION, ask, controller, free_ports, start_upstream, stop_upstream


def node(name, port):
    return {"name": name, "type": "http", "server": "127.0.0.1", "port": port}


def write_provider(path, nodes):
    staging = path.with_suffix(".tmp")
    staging.write_text(json.dumps({"proxies": nodes}), encoding="utf-8")
    staging.replace(path)


def main():
    old, new, daily, direct, mixed, dedicated, api = free_ports(7)
    destination = f"http://127.0.0.1:{direct}/"
    config = {
        "external-controller": f"127.0.0.1:{api}", "secret": SECRET,
        "mixed-port": mixed, "allow-lan": False, "mode": "rule", "geo-auto-update": False,
        "dns": {"enable": False}, "tun": {"enable": False}, "find-process-mode": "off",
        "proxies": [node("daily", daily)], "rules": ["MATCH,daily"],
        "proxy-providers": {"claude-provider": {"type": "file", "path": "./claude.yaml"}},
        "proxy-groups": [{"name": "claude-only", "type": "select", "use": ["claude-provider"],
                          "filter": "^fixed$", "empty-fallback": "REJECT"}],
        "listeners": [{"name": "claude", "type": "http", "listen": "127.0.0.1",
                       "port": dedicated, "proxy": "claude-only"}],
    }

    with ExitStack() as stack:
        tmp = Path(stack.enter_context(tempfile.TemporaryDirectory(prefix="mihomo-provider-")))
        provider = tmp / "claude.yaml"
        write_provider(provider, [node("unrelated", daily)])
        (tmp / "config.yaml").write_text(json.dumps(config), encoding="utf-8")
        for port, ip in [(new, "192.0.2.2"), (daily, "192.0.2.3"), (direct, "192.0.2.4")]:
            stack.callback(stop_upstream, start_upstream(port, {"*": ip}))
        # The destination also serves DIRECT requests. A fail-open cannot look like rejection.
        assert ask(direct, destination) == "192.0.2.4", "DIRECT control failed"
        with ExitStack() as old_exit:
            old_exit.callback(stop_upstream, start_upstream(old, {"*": "192.0.2.1"}))
            log = stack.enter_context((tmp / "mihomo.log").open("wb"))
            proc = subprocess.Popen([str(MIHOMO), "-d", str(tmp), "-f", str(tmp / "config.yaml")],
                                    cwd=tmp, stdout=log, stderr=subprocess.STDOUT)
            stack.callback(proc.wait, timeout=10)
            stack.callback(proc.terminate)
            for _ in range(100):
                status, body = controller(api, "GET", "/version")
                if status == 200 or proc.poll() is not None:
                    break
                time.sleep(0.1)
            assert status == 200 and json.loads(body)["version"] == VERSION, "isolated core not ready"

            def routes(stage, expected):
                actual = ask(dedicated, destination)
                assert actual == expected, f"{stage}: Claude returned {actual!r}, expected {expected!r}"
                assert ask(mixed, destination) == "192.0.2.3", f"{stage}: daily route changed"
                print("PASS", stage)

            def update(nodes, expected_status=(200, 204)):
                write_provider(provider, nodes)
                status, _ = controller(api, "PUT", "/providers/proxies/claude-provider")
                assert status in expected_status, f"provider update returned {status}"

            routes("cold start without a matching node", None)
            update([node("fixed", old)])
            routes("initial fixed exit", "192.0.2.1")
            old_exit.close()
            routes("failed old exit", None)
            update([node("fixed", new)])
            routes("new exit after provider update", "192.0.2.2")
            # Empty/invalid content cannot revoke an active provider. The core retains its last good data.
            update([], expected_status=(503,))
            routes("empty update refused; previous exit retained", "192.0.2.2")
            update([{"name": "fixed", "type": "reject"}])
            routes("explicit fixed-node revocation", None)
            update([node("unrelated", daily)])
            routes("missing fixed node", None)
            update([node("fixed", new)])
            routes("restored fixed node", "192.0.2.2")
            assert proc.poll() is None


if __name__ == "__main__":
    main()
