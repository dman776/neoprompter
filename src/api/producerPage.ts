/**
 * The Producer page: one self-contained HTML document (inline CSS and JS, no remote resources).
 * It never contains the API token; the page asks for it in the browser and keeps it in localStorage.
 */
export const PRODUCER_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Neoprompter Producer</title>
<style>
  :root { color-scheme: dark; --bg:#111; --fg:#f2f2f2; --muted:#9a9a9a; --card:#1e1e1e; --line:#3a3a3a; --accent:#3b82f6; --ok:#22c55e; --bad:#ef4444; }
  * { box-sizing: border-box; }
  body { margin:0; padding:16px; background:var(--bg); color:var(--fg); font:18px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  main { max-width: 640px; margin: 0 auto; display:grid; gap:16px; }
  h1 { font-size:20px; margin:0; }
  textarea, input { width:100%; font:inherit; color:var(--fg); background:var(--card); border:1px solid var(--line); border-radius:12px; padding:12px; }
  textarea { min-height:96px; resize:vertical; }
  button { font:inherit; font-weight:600; color:var(--fg); background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 16px; min-height:56px; cursor:pointer; touch-action:manipulation; }
  button.primary { background:var(--accent); border-color:var(--accent); color:#fff; width:100%; }
  button.small { min-height:48px; padding:8px 14px; }
  button:disabled { opacity:.5; }
  #quick { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; }
  .row { display:flex; gap:8px; align-items:center; }
  .row input { flex:1; min-width:0; }
  #status { min-height:28px; font-weight:600; }
  #status.ok { color:var(--ok); } #status.bad { color:var(--bad); }
  .muted { color:var(--muted); font-size:15px; }
  [hidden] { display:none !important; }
</style>
</head>
<body>
<main>
  <h1>Neoprompter: send a Notification to the Operator</h1>

  <section id="tokenBox" hidden>
    <p>This Neoprompter needs an access token. Ask the Operator for it.</p>
    <div class="row">
      <input id="tokenInput" type="password" autocomplete="off" autocapitalize="off" placeholder="Access token" aria-label="Access token">
      <button id="tokenSave" class="small">Use token</button>
    </div>
  </section>

  <section>
    <textarea id="text" maxlength="500" placeholder="Short plain-text Notification" aria-label="Notification"></textarea>
    <button id="send" class="primary">Send</button>
  </section>

  <div id="status" role="status" aria-live="polite"></div>

  <section>
    <div id="quick"></div>
    <p id="empty" class="muted" hidden>No quick messages. Tap Edit buttons to add some.</p>
  </section>

  <section>
    <button id="editToggle" class="small">Edit buttons</button>
    <div id="editor" hidden>
      <div id="editRows"></div>
      <div class="row" style="margin-top:8px">
        <button id="addRow" class="small">Add</button>
        <button id="saveList" class="small primary" style="width:auto">Save buttons</button>
      </div>
      <p class="muted">Everyone using this page sees the same buttons.</p>
    </div>
  </section>
</main>
<script>
(function () {
  var KEY = 'neoprompter-token';
  var $ = function (id) { return document.getElementById(id); };
  var messages = [];
  var token = '';
  try { token = localStorage.getItem(KEY) || ''; } catch (e) {}

  function setStatus(text, kind) {
    var s = $('status');
    s.textContent = text;
    s.className = kind || '';
  }
  function needToken(wrong) {
    $('tokenBox').hidden = false;
    setStatus(wrong ? 'Wrong or missing token. Enter the token and try again.' : 'Enter the access token to continue.', 'bad');
  }
  function call(path, method, body) {
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['X-Neoprompter-Token'] = token;
    return fetch(path, { method: method, headers: headers, body: body === undefined ? undefined : JSON.stringify(body) })
      .then(function (res) {
        if (res.status === 401) { var err = new Error('token'); err.auth = true; throw err; }
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) throw new Error(data.error || ('Error ' + res.status));
          return data;
        });
      });
  }
  function fail(e, what) {
    if (e && e.auth) return needToken(!!token);
    var offline = e instanceof TypeError;
    setStatus(offline ? 'Could not reach Neoprompter. Check you are on the same network.' : what + ' failed: ' + e.message, 'bad');
  }

  function send(text, button) {
    text = text.trim();
    if (!text) { setStatus('Type a Notification first.', 'bad'); return Promise.resolve(false); }
    if (button) button.disabled = true;
    setStatus('Sending...', '');
    return call('/api/notify', 'POST', { text: text })
      .then(function () { setStatus('Sent: ' + text, 'ok'); return true; })
      .catch(function (e) { fail(e, 'Sending'); return false; })
      .then(function (ok) { if (button) button.disabled = false; return ok; });
  }

  function renderQuick() {
    var q = $('quick');
    q.textContent = '';
    messages.forEach(function (m) {
      var b = document.createElement('button');
      b.textContent = m;
      b.onclick = function () { send(m, b); };
      q.appendChild(b);
    });
    $('empty').hidden = messages.length > 0;
  }
  function addEditRow(value) {
    var row = document.createElement('div');
    row.className = 'row';
    row.style.marginBottom = '8px';
    var input = document.createElement('input');
    input.value = value;
    input.maxLength = 500;
    input.setAttribute('aria-label', 'Quick message');
    var del = document.createElement('button');
    del.className = 'small';
    del.textContent = 'Remove';
    del.onclick = function () { row.remove(); };
    row.appendChild(input);
    row.appendChild(del);
    $('editRows').appendChild(row);
    return input;
  }
  function openEditor() {
    $('editRows').textContent = '';
    messages.forEach(addEditRow);
    $('editor').hidden = false;
    $('editToggle').textContent = 'Close editor';
  }
  function closeEditor() {
    $('editor').hidden = true;
    $('editToggle').textContent = 'Edit buttons';
  }

  function load() {
    return call('/api/quick-messages', 'GET')
      .then(function (data) { messages = data.messages || []; renderQuick(); $('tokenBox').hidden = true; if (/token/i.test($('status').textContent)) setStatus('', ''); })
      .catch(function (e) { fail(e, 'Loading buttons'); });
  }

  $('send').onclick = function () {
    send($('text').value, $('send')).then(function (ok) { if (ok) $('text').value = ''; });
  };
  $('editToggle').onclick = function () { if ($('editor').hidden) openEditor(); else closeEditor(); };
  $('addRow').onclick = function () { addEditRow('').focus(); };
  $('saveList').onclick = function () {
    var list = Array.prototype.map.call($('editRows').querySelectorAll('input'), function (i) { return i.value; });
    call('/api/quick-messages', 'POST', { messages: list })
      .then(function (data) { messages = data.messages; renderQuick(); closeEditor(); setStatus('Buttons saved.', 'ok'); })
      .catch(function (e) { fail(e, 'Saving buttons'); });
  };
  $('tokenSave').onclick = function () {
    token = $('tokenInput').value.trim();
    try { localStorage.setItem(KEY, token); } catch (e) {}
    $('tokenInput').value = '';
    load();
  };
  load();
})();
</script>
</body>
</html>
`;
