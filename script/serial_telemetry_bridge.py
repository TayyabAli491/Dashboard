#!/usr/bin/env python3
"""
Read TELEM_JSON:<payload> lines from a USB serial port and POST JSON to the
Rails dashboard (same contract as POST /api/workspaces/:id/telemetry).

Dependencies:
  pip install pyserial

Example:
  python3 script/serial_telemetry_bridge.py \\
    --port /dev/cu.usbmodem14101 \\
    --url http://127.0.0.1:3000/api/workspaces/1/telemetry \\
    --api-key e3e2a8095c1b4b76d8e5a15db006eeedfa1f4e7f
"""

from __future__ import annotations

import argparse
import json
import time
import sys
import urllib.error
import urllib.request

PREFIX = "TELEM_JSON:"


def post_json(url: str, api_key: str, payload: dict) -> tuple[int, str]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "X-API-Key": api_key,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.getcode(), body
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        return e.code, err
    except urllib.error.URLError as e:
        return 0, str(e.reason)


def open_serial(serial_mod, port: str, baud: int, retries: int = 0):
    attempts = 0
    while True:
        try:
            return serial_mod.Serial(port, baud, timeout=0.5)
        except serial_mod.SerialException as e:
            attempts += 1
            if retries and attempts > retries:
                raise
            print(f"[serial] open failed: {e}; retrying in 1s", file=sys.stderr)
            time.sleep(1)


def main() -> int:
    p = argparse.ArgumentParser(description="Serial → dashboard telemetry bridge")
    p.add_argument("--port", required=True, help="Serial device e.g. /dev/cu.usbserial-*")
    p.add_argument("--baud", type=int, default=115200)
    p.add_argument(
        "--url",
        required=True,
        help="Full URL e.g. http://127.0.0.1:3000/api/workspaces/1/telemetry",
    )
    p.add_argument("--api-key", required=True, dest="api_key")
    args = p.parse_args()

    try:
        import serial
    except ImportError:
        print("Install pyserial: pip install pyserial", file=sys.stderr)
        return 1

    ser = open_serial(serial, args.port, args.baud)
    print(f"Listening on {args.port} @ {args.baud} → {args.url}", file=sys.stderr)

    buf = ""
    while True:
        try:
            chunk = ser.read(512)
            if not chunk:
                continue
            buf += chunk.decode("utf-8", errors="ignore")
            while "\n" in buf:
                line, buf = buf.split("\n", 1)
                line = line.strip()
                if not line.startswith(PREFIX):
                    continue
                raw = line[len(PREFIX) :].strip()
                try:
                    payload = json.loads(raw)
                except json.JSONDecodeError as e:
                    print(f"[skip] bad JSON: {e}", file=sys.stderr)
                    continue
                code, msg = post_json(args.url, args.api_key, payload)
                if code and 200 <= code < 300:
                    print(f"[ok] packetID={payload.get('packetID')}", file=sys.stderr)
                else:
                    print(f"[fail] HTTP {code} {msg[:200]}", file=sys.stderr)
        except serial.SerialException as e:
            print(f"[serial] read error: {e}", file=sys.stderr)
            try:
                ser.close()
            except Exception:
                pass
            print("[serial] attempting reconnect...", file=sys.stderr)
            ser = open_serial(serial, args.port, args.baud)
            buf = ""
        except OSError as e:
            print(f"[serial] OS error: {e}", file=sys.stderr)
            try:
                ser.close()
            except Exception:
                pass
            print("[serial] attempting reconnect...", file=sys.stderr)
            ser = open_serial(serial, args.port, args.baud)
            buf = ""
        except KeyboardInterrupt:
            print("\nExiting.", file=sys.stderr)
            try:
                ser.close()
            except Exception:
                pass
            return 0


if __name__ == "__main__":
    raise SystemExit(main())
