import { net, protocol, type Session } from 'electron';
import { pathToFileURL } from 'node:url';
import { PLUGIN_SCHEME, pluginCsp, resolvePluginFile } from './pluginFiles';

/** Must run before the app is ready. */
export function registerPluginScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: PLUGIN_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

/**
 * Serves the files of one plugin to its own session. Every plugin has a session of its own, so a plugin
 * can only ever be asked for its own files; the policy goes into the response headers because this is
 * where the page comes from.
 */
export function installPluginProtocol(
  pluginSession: Session,
  pluginId: string,
  directory: string,
  grantedNetwork: readonly string[],
): void {
  const csp = pluginCsp(grantedNetwork);
  // The plugin folder may have changed since the last launch (a user replaced the plugin).
  if (pluginSession.protocol.isProtocolHandled(PLUGIN_SCHEME)) {
    pluginSession.protocol.unhandle(PLUGIN_SCHEME);
  }

  pluginSession.protocol.handle(PLUGIN_SCHEME, async (request) => {
    const file = await resolvePluginFile(directory, request.url, pluginId);
    if (!file) return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });

    const fileResponse = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(fileResponse.headers);
    headers.set('Content-Security-Policy', csp);
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(fileResponse.body, { status: fileResponse.status, headers });
  });
}
