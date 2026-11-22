import type { ApiView } from '../api';

const root = document.getElementById('companion-api')!;

root.insertAdjacentHTML(
  'beforeend',
  `<p>Lets Bitfocus Companion (or any device on this network) send Notifications and read status.
     Local network only; see docs/companion.md.</p>
   <label>Port <input id="api-port" type="number" min="1024" max="65535" /></label>
   <label>Token (optional) <input id="api-token" type="text" autocomplete="off" /></label>
   <button id="api-save">Save</button>
   <p id="api-status" role="status"></p>`,
);
const portEl = document.getElementById('api-port') as HTMLInputElement;
const tokenEl = document.getElementById('api-token') as HTMLInputElement;
const statusEl = document.getElementById('api-status')!;

function show(view: ApiView): void {
  portEl.value = String(view.port);
  tokenEl.value = view.token;
  statusEl.textContent = view.running
    ? `Listening on port ${view.port}${view.token ? ' (token required)' : ' (no token)'}.`
    : (view.error ?? 'Not running.');
}

void window.neoprompter.getApiView().then(show);
document.getElementById('api-save')!.addEventListener('click', () => {
  void window.neoprompter
    .setApiSettings({ port: Number(portEl.value), token: tokenEl.value })
    .then(show);
});
