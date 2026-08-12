/**
 * Philips Hue local-bridge client (v1 API). Talks to the bridge over the LAN
 * with plain fetch — discovery is HTTPS via Philips, bridge control is HTTP on
 * the local network (allowed by the app's network-security config).
 */
export type HueBridge = {id: string; ip: string};
export type HueLight = {id: string; name: string; on: boolean; reachable: boolean};
export type HueCreds = {ip: string; username: string};

export class LinkButtonNotPressed extends Error {
  constructor() {
    super('LINK_NOT_PRESSED');
    this.name = 'LinkButtonNotPressed';
  }
}

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** Ask Philips' discovery service which bridges are on this network. */
export async function discoverBridges(): Promise<HueBridge[]> {
  return withTimeout(7000, async signal => {
    const res = await fetch('https://discovery.meethue.com/', {signal});
    const data = (await res.json()) as Array<{id: string; internalipaddress: string}>;
    return (data ?? []).filter(b => b.internalipaddress).map(b => ({id: b.id, ip: b.internalipaddress}));
  });
}

/**
 * Attempt to pair. The user must press the round link button on the bridge
 * first; until they do, the bridge replies with error type 101 and we throw
 * LinkButtonNotPressed so the caller can keep polling.
 */
export async function pair(ip: string): Promise<string> {
  return withTimeout(7000, async signal => {
    const res = await fetch(`http://${ip}/api`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({devicetype: 'minimal_alarm#phone'}),
      signal,
    });
    const data = await res.json();
    const first = Array.isArray(data) ? data[0] : data;
    if (first?.success?.username) return first.success.username as string;
    if (first?.error?.type === 101) throw new LinkButtonNotPressed();
    throw new Error(first?.error?.description ?? 'Pairing failed');
  });
}

export async function fetchLights(creds: HueCreds): Promise<HueLight[]> {
  return withTimeout(7000, async signal => {
    const res = await fetch(`http://${creds.ip}/api/${creds.username}/lights`, {signal});
    const data = await res.json();
    if (Array.isArray(data) && data[0]?.error) throw new Error(data[0].error.description ?? 'Bridge rejected the request');
    return Object.entries(data as Record<string, any>).map(([id, light]) => ({
      id,
      name: light?.name ?? `Light ${id}`,
      on: !!light?.state?.on,
      reachable: light?.state?.reachable !== false,
    }));
  });
}

export async function setLight(creds: HueCreds, id: string, on: boolean): Promise<void> {
  await withTimeout(5000, async signal => {
    await fetch(`http://${creds.ip}/api/${creds.username}/lights/${id}/state`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(on ? {on: true, bri: 254, transitiontime: 4} : {on: false, transitiontime: 4}),
      signal,
    });
  });
}
