import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  PLUGIN_SCHEME,
  isAllowedPluginRequest,
  isOwnPluginUrl,
  pluginCsp,
  pluginUrl,
  resolvePluginFile,
} from '../../../src/main/plugins/pluginFiles';

const ID = 'at.example.tool';

describe('pluginFiles', () => {
  let tmp: string;
  let root: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grdr-plugin-files-'));
    root = path.join(tmp, 'tool');
    fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(root, 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(root, 'assets', 'app.js'), 'x');
    fs.writeFileSync(path.join(root, 'with space.txt'), 'x');
    fs.writeFileSync(path.join(tmp, 'secret.txt'), 'secret');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  describe('pluginUrl', () => {
    it('builds the url a plugin window loads', () => {
      expect(pluginUrl(ID, 'index.html')).toBe('grdr-plugin://at.example.tool/index.html');
    });

    it('keeps sub directories and escapes characters that need it', () => {
      expect(pluginUrl(ID, 'app/with space.html')).toBe('grdr-plugin://at.example.tool/app/with%20space.html');
    });
  });

  describe('resolvePluginFile', () => {
    const resolve = (url: string): Promise<string | null> => resolvePluginFile(root, url, ID);
    const real = (...parts: string[]): string => fs.realpathSync(path.join(root, ...parts));

    it('resolves a file of the plugin', async () => {
      expect(await resolve(`${PLUGIN_SCHEME}://${ID}/index.html`)).toBe(real('index.html'));
    });

    it('resolves a file in a sub directory', async () => {
      expect(await resolve(`${PLUGIN_SCHEME}://${ID}/assets/app.js`)).toBe(real('assets', 'app.js'));
    });

    it('ignores the query and the fragment', async () => {
      expect(await resolve(`${PLUGIN_SCHEME}://${ID}/index.html?v=1#top`)).toBe(real('index.html'));
    });

    it('decodes escaped characters in the path', async () => {
      expect(await resolve(`${PLUGIN_SCHEME}://${ID}/with%20space.txt`)).toBe(real('with space.txt'));
    });

    it('works when the plugin folder itself is reached through a symlink', async () => {
      const link = path.join(tmp, 'link-to-tool');
      fs.symlinkSync(root, link);

      expect(await resolvePluginFile(link, `${PLUGIN_SCHEME}://${ID}/index.html`, ID)).toBe(real('index.html'));
    });

    describe('refuses', () => {
      it.each([
        ['another plugin\'s host', `${PLUGIN_SCHEME}://at.example.other/index.html`],
        ['another scheme', 'https://at.example.tool/index.html'],
        ['a file url', 'file:///etc/passwd'],
        ['a malformed url', 'not a url'],
        ['an empty url', ''],
      ])('%s', async (_label, url) => {
        expect(await resolve(url)).toBeNull();
      });

      it.each([
        ['a parent segment', '/../secret.txt'],
        ['a nested parent segment', '/assets/../../secret.txt'],
        ['an encoded parent segment', '/%2e%2e/secret.txt'],
        ['an encoded slash hiding a parent segment', '/..%2F..%2Fsecret.txt'],
        ['an encoded slash after a segment', '/assets%2F..%2F..%2Fsecret.txt'],
        ['a double encoded parent segment', '/%252e%252e/secret.txt'],
        ['a backslash parent segment', '/..%5Csecret.txt'],
        ['an absolute path smuggled in', '//etc/passwd'],
        ['a NUL byte', '/index.html%00.png'],
        ['a malformed escape', '/%E0%A4%A'],
      ])('%s', async (_label, pathname) => {
        expect(await resolve(`${PLUGIN_SCHEME}://${ID}${pathname}`)).toBeNull();
      });

      it('a symlink inside the plugin that points outside of it', async () => {
        fs.symlinkSync(path.join(tmp, 'secret.txt'), path.join(root, 'leak.txt'));
        fs.symlinkSync(tmp, path.join(root, 'out'));

        expect(await resolve(`${PLUGIN_SCHEME}://${ID}/leak.txt`)).toBeNull();
        expect(await resolve(`${PLUGIN_SCHEME}://${ID}/out/secret.txt`)).toBeNull();
      });

      it('a file that does not exist', async () => {
        expect(await resolve(`${PLUGIN_SCHEME}://${ID}/missing.js`)).toBeNull();
      });

      it.each(['/', '/assets', '/assets/'])('the directory %s', async (pathname) => {
        expect(await resolve(`${PLUGIN_SCHEME}://${ID}${pathname}`)).toBeNull();
      });

      it('a plugin folder that does not exist', async () => {
        expect(await resolvePluginFile(path.join(tmp, 'gone'), `${PLUGIN_SCHEME}://${ID}/index.html`, ID)).toBeNull();
      });

      it('a sibling folder whose name starts like the plugin folder', async () => {
        fs.mkdirSync(path.join(tmp, 'tool-evil'));
        fs.writeFileSync(path.join(tmp, 'tool-evil', 'x.txt'), 'x');

        expect(await resolve(`${PLUGIN_SCHEME}://${ID}/..%2Ftool-evil%2Fx.txt`)).toBeNull();
      });
    });
  });

  describe('isAllowedPluginRequest', () => {
    it.each([
      `${PLUGIN_SCHEME}://${ID}/index.html`,
      `${PLUGIN_SCHEME}://${ID}/assets/app.js?x=1`,
      'data:image/png;base64,AAAA',
      'devtools://devtools/bundled/inspector.html',
    ])('allows %s', (url) => {
      expect(isAllowedPluginRequest(url, ID)).toBe(true);
    });

    it.each([
      ['another plugin', `${PLUGIN_SCHEME}://at.example.other/index.html`],
      ['the web', 'https://example.com/x.js'],
      ['insecure http', 'http://example.com/x.js'],
      ['a local file', 'file:///etc/passwd'],
      ['grader itself', 'grdr://app/index.html'],
      ['a websocket', 'wss://example.com/socket'],
      ['an extension', 'chrome-extension://abc/x.js'],
      ['garbage', 'not a url'],
    ])('blocks %s', (_label, url) => {
      expect(isAllowedPluginRequest(url, ID)).toBe(false);
    });
  });

  describe('isOwnPluginUrl', () => {
    it('is true only for a page of the plugin itself', () => {
      expect(isOwnPluginUrl(`${PLUGIN_SCHEME}://${ID}/index.html`, ID)).toBe(true);
      expect(isOwnPluginUrl(`${PLUGIN_SCHEME}://${ID}/app/page.html#x`, ID)).toBe(true);
    });

    it.each([
      `${PLUGIN_SCHEME}://at.example.other/index.html`,
      'https://example.com',
      'data:text/html,<script>1</script>',
      'devtools://devtools/bundled/inspector.html',
      'file:///etc/passwd',
      'not a url',
    ])('is false for %s, which a plugin window must not navigate to', (url) => {
      expect(isOwnPluginUrl(url, ID)).toBe(false);
    });
  });

  describe('isAllowedPluginRequest with granted origins', () => {
    const GRANTED = ['https://api.github.com', 'https://example.org:8443'];

    it.each([
      'https://api.github.com/graphql',
      'https://api.github.com:443/graphql',
      'https://API.GITHUB.COM/graphql?x=1',
      'https://example.org:8443/data',
    ])('allows %s', (url) => {
      expect(isAllowedPluginRequest(url, ID, GRANTED)).toBe(true);
    });

    it.each([
      ['another host', 'https://example.com/x'],
      ['a subdomain of a granted host', 'https://evil.api.github.com/x'],
      ['a host that only starts like a granted one', 'https://api.github.com.evil.net/x'],
      ['a granted host on another port', 'https://api.github.com:8443/x'],
      ['a granted host without its port', 'https://example.org/x'],
      ['insecure http on a granted host', 'http://api.github.com/graphql'],
      ['a websocket on a granted host', 'wss://api.github.com/socket'],
      ['user info that hides another host', 'https://api.github.com@evil.net/x'],
      ['a file url', 'file:///etc/passwd'],
    ])('still blocks %s', (_label, url) => {
      expect(isAllowedPluginRequest(url, ID, GRANTED)).toBe(false);
    });

    it('blocks every origin when none is granted', () => {
      expect(isAllowedPluginRequest('https://api.github.com/graphql', ID)).toBe(false);
      expect(isAllowedPluginRequest('https://api.github.com/graphql', ID, [])).toBe(false);
    });

    it('still allows the own files and inline data', () => {
      expect(isAllowedPluginRequest(`${PLUGIN_SCHEME}://${ID}/index.html`, ID, GRANTED)).toBe(true);
      expect(isAllowedPluginRequest('data:image/png;base64,AAAA', ID, GRANTED)).toBe(true);
    });
  });

  describe('pluginCsp', () => {
    it('only lets a plugin load and connect to its own origin when no network is granted', () => {
      const csp = pluginCsp([]);
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp.split('; ')).toContain("connect-src 'self'");
    });

    it('adds the granted origins to connect-src and to nothing else', () => {
      const csp = pluginCsp(['https://api.github.com', 'https://example.org:8443']);

      expect(csp.split('; ')).toContain("connect-src 'self' https://api.github.com https://example.org:8443");
      expect(csp.match(/api\.github\.com/g)).toHaveLength(1);
      expect(csp).toContain("script-src 'self';");
    });

    it('does not allow inline or eval scripts', () => {
      const scriptDirective = pluginCsp(['https://api.github.com']).split(';').find((d) => d.trim().startsWith('script-src')) ?? '';
      expect(scriptDirective).not.toMatch(/unsafe/);
    });

    it('does not let the plugin be framed or submit forms elsewhere', () => {
      const csp = pluginCsp(['https://api.github.com']);
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("form-action 'none'");
    });

    it('refuses an origin that could inject another directive', () => {
      expect(pluginCsp(["https://a.com; script-src *", 'https://ok.example.com']).split('; ')).toContain(
        "connect-src 'self' https://ok.example.com",
      );
    });
  });
});
