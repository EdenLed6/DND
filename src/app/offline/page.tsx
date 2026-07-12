export const dynamic = "force-static";

export default function Offline() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-6 text-center">
      <div className="card max-w-sm">
        <div className="text-4xl">🐉</div>
        <h1 className="mt-2 font-display text-xl text-gold">You're offline</h1>
        <p className="muted mt-2 text-sm">This page needs a connection. Reconnect and try again — your campaign data is safe on the server.</p>
      </div>
    </div>
  );
}
