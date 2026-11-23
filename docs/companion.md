# Bitfocus Companion setup

NeoPrompter runs a small HTTP service so Companion (or anything on the same network) can show a Notification in the Operator view and read the current status. It cannot start, stop, move or load anything: Notifications and status only. The Output never shows Notifications.

Set the port (default `4780`) and an optional token in Preferences (File menu), under Network. Use the Operator computer's LAN address below, for example `192.168.1.20`. If the port is taken, the Network page says so; pick another one.

If a token is set, every request must carry it, or it gets `401`. Either of:

- header `Authorization: Bearer <token>`
- header `X-Neoprompter-Token: <token>`
- HTTP Basic, with the token as the password and any username (this is what a browser's own password box sends)

The Producer page needs the token too: the browser asks for it in its own password box when the page opens (any username, the token as the password). A `?token=` query string is not accepted (URLs end up in logs and browser history).

Requests from outside the local network get `403` whatever the token.

## Send a Notification (button press)

Add the action **Generic: HTTP Requests > POST**:

- URL: `http://192.168.1.20:4780/api/notify`
- Body: `{"text": "Wrap up in 2 minutes", "durationMs": 10000}`
- Header (JSON): `{"Content-Type": "application/json", "X-Neoprompter-Token": "<token>"}`

`text` is required (plain text, up to 500 characters). `durationMs` is optional (milliseconds); without it the display time set in Preferences (Notifications) applies. Success is `202 {"ok":true}`; bad input is `400`.

Test from a terminal:

```
curl -X POST http://192.168.1.20:4780/api/notify -H 'X-Neoprompter-Token: <token>' -d '{"text":"Hello"}'
```

## Poll status (button feedback)

Create a **Generic HTTP** module (or the HTTP polling feature of your Companion version) that does `GET http://192.168.1.20:4780/api/status` every second or two, with the header `X-Neoprompter-Token: <token>` if a token is set. The reply:

```
{"script":"Sunday sermon","state":"playing","playing":true,"position":42.5,"progress":0.31,"mode":"run","outputOn":true,"version":"0.1.0"}
```

- `state` is `"playing"` or `"paused"`; `position` is in lines; `progress` is 0 to 1; `mode` is `"edit"` or `"run"`; `outputOn` is whether the Output is on; `version` is the NeoPrompter version.
- For feedback, parse the JSON (for example with a variable from JSON path `$.state`) and style a button when it equals `playing`, or show `$.script` as button text.

## All endpoints

| Method | Path          | Purpose                                       |
| ------ | ------------- | --------------------------------------------- |
| POST   | `/api/notify` | Show a Notification                           |
| GET    | `/api/status` | Script name, state, progress, mode, Output on |

Anything else returns `404` (or `405` for the wrong method). Bodies over 4 KB return `413`.
