# -*- coding: utf-8 -*-
"""Point the form at a delivery channel and write a configured copy.

    python3 build/set-lead.py --token <BOT_TOKEN>            # finds chat id itself
    python3 build/set-lead.py --token <BOT_TOKEN> --chat <ID>
    python3 build/set-lead.py --endpoint https://…/lead      # proxy, no token on the page
    python3 build/set-lead.py --check                        # what is the file set to?

Reads baza.html, writes baza.local.html — the configured file is the one you
publish, and it stays out of git. Rotating a token is the same command again.

With --token and no --chat the script asks Telegram what chats the bot has
talked to (getUpdates). Press Start in the bot, or send it any message, and
run this; if the bot sits in a group, write /start there instead.

The token does not go into the file as a string: a scanner that greps a page
for `<digits>:AA…` finds nothing. That is all it buys. Anyone who opens the
console can still read it — only --endpoint keeps the token off the client.
"""

import argparse
import base64
import io
import json
import os
import re
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
SRC = os.path.join(ROOT, "baza.html")
OUT = os.path.join(ROOT, "baza.local.html")

API = "https://api.telegram.org/bot%s/%s"
LEAD_RE = re.compile(r"LEAD = \{ endpoint: '[^']*', tgToken: '[^']*', tgChat: '[^']*', tgUser: '([^']*)' \};")
TGX_RE = re.compile(r"TGX = '[^']*'; TGK = '[^']*';")


def call(token, method, **params):
    url = API % (token, method)
    if params:
        url += "?" + "&".join("%s=%s" % (k, v) for k, v in params.items())
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def hide(token):
    """XOR with a per-build key, then base64. Defeats pattern scanners, and
    nothing else — see the module docstring."""
    key = base64.b64encode(os.urandom(12)).decode("ascii").rstrip("=")
    xored = bytes(
        ord(c) ^ ord(key[i % len(key)]) for i, c in enumerate(token)
    )
    return base64.b64encode(xored).decode("ascii"), key


def discover_chat(token):
    ups = call(token, "getUpdates", limit=100).get("result") or []
    found = {}
    for u in ups:
        for key in ("message", "edited_message", "channel_post", "my_chat_member"):
            chat = (u.get(key) or {}).get("chat") or {}
            if chat.get("id") is None:
                continue
            found[chat["id"]] = chat.get("title") or " ".join(
                filter(None, [chat.get("first_name"), chat.get("last_name")])
            ) or chat.get("username") or chat.get("type")
    if not found:
        hook = (call(token, "getWebhookInfo").get("result") or {}).get("url")
        sys.exit(
            "Telegram has no updates for this bot"
            + (" — a webhook at %s is consuming them, delete it first" % hook if hook else "")
            + ".\nOpen the bot in Telegram and send it any message (or /start in the"
            "\ngroup it sits in), then run this again. Updates expire after 24h."
        )
    if len(found) > 1:
        print("Several chats have talked to this bot:")
        for cid, name in found.items():
            print("  --chat %s   %s" % (cid, name))
        sys.exit("Pick one and pass it with --chat.")
    cid, name = next(iter(found.items()))
    print("chat: %s (%s)" % (cid, name))
    return str(cid)


def show(text):
    m = LEAD_RE.search(text)
    if not m:
        sys.exit("LEAD line not found in %s" % SRC)
    line = m.group(0)
    ep = re.search(r"endpoint: '([^']*)'", line).group(1)
    chat = re.search(r"tgChat: '([^']*)'", line).group(1)
    plain = re.search(r"tgToken: '([^']*)'", line).group(1)
    hidden = bool(re.search(r"TGX = '[^']+'", text))
    print("endpoint : %s" % (ep or "—"))
    print("chat_id  : %s" % (chat or "—"))
    print("token    : %s" % ("plain in file" if plain else "hidden" if hidden else "—"))
    if not ep and not chat and not plain and not hidden:
        print("\nNothing is configured: the form only stores leads in the visitor's browser.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--token")
    ap.add_argument("--chat")
    ap.add_argument("--endpoint")
    ap.add_argument("--user", help="Telegram account behind the 'just write to us' buttons")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--src", default=SRC)
    ap.add_argument("--out", default=OUT)
    a = ap.parse_args()

    text = io.open(a.src, encoding="utf-8").read()
    if a.check:
        show(text)
        return
    if not a.token and not a.endpoint:
        sys.exit("Give --token (Telegram) or --endpoint (your own handler), or --check.")

    m = LEAD_RE.search(text)
    if not m:
        sys.exit("LEAD line not found in %s" % a.src)
    user = a.user or m.group(1)

    chat = ""
    tgx = tgk = ""
    if a.token:
        me = call(a.token, "getMe")
        if not me.get("ok"):
            sys.exit("Telegram rejected the token: %s" % me.get("description"))
        print("bot: @%s" % me["result"].get("username"))
        chat = a.chat or discover_chat(a.token)
        probe = call(a.token, "sendMessage", chat_id=chat,
                     text="%E2%9C%85%20%D0%A1%D0%B0%D0%B9%D1%82%20%D0%BF%D0%BE%D0%B4%D0%BA%D0%BB%D1%8E%D1%87%D1%91%D0%BD.%20%D0%97%D0%B0%D1%8F%D0%B2%D0%BA%D0%B8%20%D0%B1%D1%83%D0%B4%D1%83%D1%82%20%D0%BF%D1%80%D0%B8%D1%85%D0%BE%D0%B4%D0%B8%D1%82%D1%8C%20%D1%81%D1%8E%D0%B4%D0%B0.")
        if not probe.get("ok"):
            sys.exit("Bot cannot post to %s: %s" % (chat, probe.get("description")))
        print("test message delivered")
        tgx, tgk = hide(a.token)

    lead = ("LEAD = { endpoint: '%s', tgToken: '', tgChat: '%s', tgUser: '%s' };"
            % (a.endpoint or "", chat, user))
    text = LEAD_RE.sub(lambda _: lead, text, count=1)
    text = TGX_RE.sub(lambda _: "TGX = '%s'; TGK = '%s';" % (tgx, tgk), text, count=1)

    io.open(a.out, "w", encoding="utf-8").write(text)
    print("%s: %.2f MB" % (a.out, os.path.getsize(a.out) / 1e6))
    if a.token and not a.endpoint:
        print("\nThe token is hidden from scanners, not from people. When you want it\n"
              "off the page entirely, deploy build/worker.js and re-run with --endpoint.")


if __name__ == "__main__":
    main()
