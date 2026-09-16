'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const docsVersionMenu = require(
    '../src/docs_versions_menu/_js/docs-versions-menu-lib.js'
);

function setWindowLocation(url) {
    global.window = new JSDOM('', { url }).window;
}

function mockFetch(t, existingUrls) {
    t.mock.method(global, 'fetch', async (url) => {
        const ok = existingUrls.includes(url);
        return {
            ok,
            status: ok ? 200 : 404,
            statusText: ok ? 'OK' : 'Not Found',
        };
    });
}

test('getRootUrl', async (t) => {
    t.afterEach(() => {
        delete global.window;
    });

    await t.test(
        'walks up the URL path until fetch finds versions.json',
        async (t) => {
            mockFetch(t, ['https://example.com/docs/v1.0/versions.json']);
            setWindowLocation(
                'https://example.com/docs/v1.0/guide/intro.html'
            );

            const rootUrl = await docsVersionMenu.getRootUrl();

            assert.equal(rootUrl, 'https://example.com/docs/v1.0');
        }
    );

    await t.test(
        'returns the origin when versions.json is at the root',
        async (t) => {
            mockFetch(t, ['https://example.com/versions.json']);
            setWindowLocation('https://example.com/index.html');

            const rootUrl = await docsVersionMenu.getRootUrl();

            assert.equal(rootUrl, 'https://example.com');
        }
    );

    await t.test(
        'throws when no versions.json can be found anywhere on the path',
        async (t) => {
            mockFetch(t, []);
            setWindowLocation(
                'https://example.com/docs/v1.0/guide/intro.html'
            );

            await assert.rejects(
                () => docsVersionMenu.getRootUrl(),
                /could not find versions\.json/
            );
        }
    );
});
