"use client";

import { useEffect, useState, useTransition } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Landmark, LineChart, RefreshCw, Sparkles } from "lucide-react";
import {
  startPlaidLink,
  finishPlaidLink,
  syncPlaid,
  connectSnapTrade,
  syncSnapTrade,
} from "@/app/(app)/connect/actions";

function Note({ msg, ok }: { msg: string; ok?: boolean }) {
  if (!msg) return null;
  return (
    <p className={`mt-2 rounded-lg px-3 py-2 text-sm ${ok ? "bg-positive/10 text-positive" : "bg-warning/10 text-warning"}`}>
      {msg}
    </p>
  );
}

function PlaidCard({ enabled, hasItems }: { enabled: boolean; hasItems: boolean }) {
  const [token, setToken] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  const { open, ready } = usePlaidLink({
    token,
    onSuccess: (publicToken) => {
      start(async () => {
        const res = await finishPlaidLink(publicToken);
        setOk(res.ok);
        setMsg(res.ok ? `${res.message} Imported ${res.imported ?? 0} transactions.` : res.message);
        setToken(null);
      });
    },
    onExit: () => setToken(null),
  });

  useEffect(() => {
    if (token && ready) open();
  }, [token, ready, open]);

  const connect = () =>
    start(async () => {
      setMsg("");
      const res = await startPlaidLink();
      if (res.error) {
        setOk(false);
        setMsg(res.error);
      } else if (res.linkToken) {
        setToken(res.linkToken);
      }
    });

  const sync = () =>
    start(async () => {
      const res = await syncPlaid();
      setOk(res.ok);
      setMsg(res.ok ? `${res.message} Imported ${res.imported ?? 0} transactions.` : res.message);
    });

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 font-bold">
        <Landmark className="h-4 w-4 text-brand" /> Banks & cards
        <span className="chip ml-auto bg-surface-2 text-muted">Plaid</span>
      </div>
      <p className="mt-2 text-sm text-muted">
        Connect a checking, savings, or credit account. In sandbox use{" "}
        <code className="rounded bg-surface-2 px-1">user_good</code> /{" "}
        <code className="rounded bg-surface-2 px-1">pass_good</code>.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={connect} disabled={!enabled || pending} className="btn-primary">
          <Sparkles className="h-4 w-4" /> Connect a bank
        </button>
        {hasItems && (
          <button onClick={sync} disabled={!enabled || pending} className="btn-ghost">
            <RefreshCw className="h-4 w-4" /> Sync
          </button>
        )}
      </div>
      {!enabled && <Note msg="Add PLAID_CLIENT_ID and PLAID_SECRET to .env to enable (see README)." />}
      <Note msg={msg} ok={ok} />
    </div>
  );
}

function SnapTradeCard({ enabled, hasConn }: { enabled: boolean; hasConn: boolean }) {
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  const connect = () =>
    start(async () => {
      setMsg("");
      const res = await connectSnapTrade();
      if (res.error) {
        setOk(false);
        setMsg(res.error);
      } else if (res.url) {
        window.location.href = res.url;
      }
    });

  const sync = () =>
    start(async () => {
      const res = await syncSnapTrade();
      setOk(res.ok);
      setMsg(res.ok ? `${res.message} Imported ${res.imported ?? 0} activities.` : res.message);
    });

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 font-bold">
        <LineChart className="h-4 w-4 text-brand" /> Brokerages & crypto
        <span className="chip ml-auto bg-surface-2 text-muted">SnapTrade</span>
      </div>
      <p className="mt-2 text-sm text-muted">
        Link a brokerage or crypto exchange through SnapTrade’s secure portal, then sync holdings & activity.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={connect} disabled={!enabled || pending} className="btn-primary">
          <Sparkles className="h-4 w-4" /> Connect a broker
        </button>
        {hasConn && (
          <button onClick={sync} disabled={!enabled || pending} className="btn-ghost">
            <RefreshCw className="h-4 w-4" /> Sync
          </button>
        )}
      </div>
      {!enabled && <Note msg="Add SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY to .env to enable (see README)." />}
      <Note msg={msg} ok={ok} />
    </div>
  );
}

export function ConnectPanel({
  plaidEnabled,
  snapEnabled,
  hasPlaidItems,
  hasSnapConn,
}: {
  plaidEnabled: boolean;
  snapEnabled: boolean;
  hasPlaidItems: boolean;
  hasSnapConn: boolean;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PlaidCard enabled={plaidEnabled} hasItems={hasPlaidItems} />
      <SnapTradeCard enabled={snapEnabled} hasConn={hasSnapConn} />
    </div>
  );
}
