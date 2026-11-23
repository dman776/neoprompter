import { useEffect, useState } from 'react';
import type { ApiView } from '../api';
import { useApiView } from '../operator/useCoreState';
import { Button } from '../operator/ui/Button';
import { Row } from './controls';
import type { PageProps } from './categories';

const MIN_PORT = 1024;
const MAX_PORT = 65535;
const MAX_MESSAGE_LENGTH = 500;
const MAX_MESSAGES = 30;

/** Port, access token, the Producer page address and its status. */
export function ConnectionTab({ bridge }: PageProps) {
  const polled = useApiView(bridge);
  // What the last save returned is newer than the poll, until the poll catches up.
  const [saved, setSaved] = useState<ApiView | null>(null);
  const view = saved ?? polled;
  useEffect(() => setSaved(null), [polled]);
  if (!view) return null;
  return <Settings view={view} onSaved={setSaved} bridge={bridge} />;
}

function Settings({
  view,
  onSaved,
  bridge,
}: {
  view: ApiView;
  onSaved: (view: ApiView) => void;
  bridge: PageProps['bridge'];
}) {
  const [port, setPort] = useState(String(view.port));
  const [token, setToken] = useState(view.token);
  const [portProblem, setPortProblem] = useState(false);

  const save = (next: { port: number; token: string }) =>
    void bridge.setApiSettings(next).then(onSaved);

  const commitPort = () => {
    const n = Number(port);
    if (!Number.isInteger(n) || n < MIN_PORT || n > MAX_PORT) {
      setPortProblem(true);
      setPort(String(view.port));
      return;
    }
    setPortProblem(false);
    if (n !== view.port) save({ port: n, token: view.token });
  };
  const commitToken = () => {
    const clean = token.trim();
    setToken(clean);
    if (clean !== view.token) save({ port: view.port, token: clean });
  };
  const enter = (commit: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit();
  };

  return (
    <>
      <Row title="Port" help={`From ${MIN_PORT} to ${MAX_PORT}. Applies when you leave the field.`}>
        <input
          type="text"
          inputMode="numeric"
          aria-label="Port"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          onBlur={commitPort}
          onKeyDown={enter(commitPort)}
        />
      </Row>
      {portProblem && (
        <p className="pf-notice">
          That port is not allowed. Use a number from {MIN_PORT} to {MAX_PORT}.
        </p>
      )}
      <Row
        title="Access token"
        help="Needed to open the Producer page and to call the API. Leave it empty to let any device on this network in."
      >
        <input
          type="password"
          autoComplete="off"
          aria-label="Access token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onBlur={commitToken}
          onKeyDown={enter(commitToken)}
        />
      </Row>
      <Row title="Producer page" help="Open on any phone on this network. It asks for the token.">
        <div className="pf-address">
          {view.producerUrls.map((url) => (
            <code key={url}>{url}</code>
          ))}
        </div>
      </Row>
      <p className="pf-status" role="status">
        {view.running
          ? `Listening on port ${view.port}${view.token ? ' (token required).' : ' (no token).'}`
          : (view.error ?? 'Not running.')}
      </p>
    </>
  );
}

/** The one list of Quick messages every Producer's browser shows. Each change is saved at once. */
export function QuickMessagesTab({ bridge }: PageProps) {
  const [messages, setMessages] = useState<string[] | null>(null);
  const [draft, setDraft] = useState('');
  useEffect(() => {
    let live = true;
    void bridge.getQuickMessages().then((m) => live && setMessages(m));
    return () => {
      live = false;
    };
  }, [bridge]);
  if (!messages) return null;

  const save = (next: string[]) => void bridge.setQuickMessages(next).then(setMessages);
  const add = () => {
    if (draft.trim() === '') return;
    save([...messages, draft]);
    setDraft('');
  };

  return (
    <div className="pf-quick">
      <p className="pf-quick-help">One tap on the Producer page sends one to the Operator.</p>
      <div className="pf-messages pf-messages-list" data-scrolls="true">
        {messages.map((m, i) => (
          <div className="pf-inline" key={i}>
            <input
              type="text"
              aria-label={`Quick message ${i + 1}`}
              maxLength={MAX_MESSAGE_LENGTH}
              value={m}
              onChange={(e) =>
                setMessages(messages.map((old, j) => (j === i ? e.target.value : old)))
              }
              onBlur={() => save(messages)}
            />
            <Button
              aria-label={`Remove Quick message ${i + 1}`}
              onClick={() => save(messages.filter((_, j) => j !== i))}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
      <div className="pf-messages">
        <div className="pf-inline">
          <input
            type="text"
            aria-label="New Quick message"
            placeholder="New Quick message"
            maxLength={MAX_MESSAGE_LENGTH}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <Button
            variant="primary"
            disabled={draft.trim() === '' || messages.length >= MAX_MESSAGES}
            onClick={add}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
