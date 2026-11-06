// The theme preview host (impl-commerce P5, F54; design-shop §12.6; Shop/ShopPreview.js, ShopPreview.xml): on a site's
// preview host only /preview/{token} and its assets route, everything else is Not Found, and the live host never reaches
// the preview; the preview page is the draft rendered through the adapter with the trusted components, its sections
// marked for selection and its script by nonce, sent no-store, noindex, without referrer and framed only by the
// configured BOSS origins; a token of another site or a forged one is Not Found. An image uploaded to the draft (F55) is
// served as bytes by the preview and, once published, by the live asset route.
const lib = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const preview = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopPreview.js')
const theme = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopTheme.js')
const T = 'mantle.public.ThemeServices.'
const SITE = 'PASS_SHOP_PREVIEW',
    HOST = 'preview-live.shop.example.test',
    PREVIEW_HOST = 'preview.preview-live.shop.example.test'
const state = {}
// A 1x1 PNG.
const PNG =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
/* The response a page writes its headers to. */
function fakeResponse() {
    const headers = {}
    return { headers, setHeader: (name, value) => (headers[name] = value) }
}
spec({
    setupSpec() {
        login('john.doe')
        const l = lib()
        l.records()
        l.site(SITE, HOST)
        l.mounts(SITE, [
            { app: 'shop', pathPrefix: '/', targetId: l.ids.store },
        ])
        l.run('create#mantle.public.PublicSiteHost', {
            hostname: PREVIEW_HOST,
            siteId: SITE,
            canonical: 'N',
            hostKindEnumId: 'PshkPreview',
        })
        state.themeId = l.run(T + 'create#ThemeDraft', {
            productStoreId: l.ids.store,
            starter: 'mr-pass/starter',
        }).themeId
        const made = l.run(T + 'create#ThemePreview', {
            themeId: state.themeId,
            siteId: SITE,
            pageKind: 'home',
        })
        state.token = made.previewPath.split('/').pop()
    },
    cleanup() {
        login('john.doe')
    },
})
feature(
    'the preview host routes only the preview, and the live host never reaches it',
    {
        when() {
            const l = lib()
            return {
                page: l.route(SITE, PREVIEW_HOST, '/preview/' + state.token),
                asset: l.route(
                    SITE,
                    PREVIEW_HOST,
                    '/preview/' + state.token + '/asset/store.css',
                ),
                home: l.route(SITE, PREVIEW_HOST, '/'),
                account: l.route(SITE, PREVIEW_HOST, '/account/Login'),
                parent: l.route(
                    SITE,
                    PREVIEW_HOST,
                    '/preview/' + state.token + '/asset/../theme.json',
                ),
                live: l.route(SITE, HOST, '/preview/' + state.token),
                hostKind: preview().isPreviewHost(SITE, PREVIEW_HOST),
                liveKind: preview().isPreviewHost(SITE, HOST),
            }
        },
        then({ page, asset, home, account, parent, live, hostKind, liveKind }) {
            page === '/ShopPreview/page'
            asset === '/ShopPreview/asset'
            home === 'refused:NotFound'
            account === 'refused:NotFound'
            parent === 'refused:NotFound'
            live === '/Shop/preview/' + state.token
            hostKind === true
            liveKind === false
        },
    },
)
feature(
    'the preview page is the draft through the adapter, marked for selection, framed only by the BOSS origins',
    {
        when() {
            const response = fakeResponse()
            const rendered = preview().page(SITE, PREVIEW_HOST, state.token)
            preview().headers(response, 'NONCE123')
            const css = preview().asset(
                SITE,
                PREVIEW_HOST,
                state.token,
                'store.css',
            )
            const refused = (siteId, host, token) => {
                try {
                    preview().page(siteId, host, token)
                    return 'served'
                } catch (error) {
                    return error.moquiErrorKind
                }
            }
            return {
                rendered,
                scriptByNonce: /<script nonce="[A-Za-z0-9]+">/.test(
                    rendered.html,
                ),
                headers: response.headers,
                css,
                otherHost: refused(SITE, HOST, state.token),
                forged: refused(
                    SITE,
                    PREVIEW_HOST,
                    state.token.slice(0, -1) +
                        (state.token.endsWith('Q') ? 'R' : 'Q'),
                ),
            }
        },
        then({ rendered, scriptByNonce, headers, css, otherHost, forged }) {
            rendered.html.includes('Shop Spec Store')
            rendered.html.includes('data-section-id="hero"')
            scriptByNonce
            rendered.html.includes('"moqui-theme-preview"')
            rendered.html.includes(
                '/preview/' + state.token + '/asset/store.css',
            )
            headers['Cache-Control'] === 'no-store'
            headers['X-Robots-Tag'] === 'noindex, nofollow'
            headers['Referrer-Policy'] === 'no-referrer'
            headers['Content-Security-Policy'].includes(
                'frame-ancestors http://localhost:* http://127.0.0.1:*',
            )
            headers['Content-Security-Policy'].includes(
                "script-src 'nonce-NONCE123'",
            )
            headers['Content-Security-Policy'].includes("form-action 'none'")
            css.contentType.startsWith('text/css')
            otherHost === 'NotFound'
            forged === 'NotFound'
        },
    },
)
feature(
    'an image uploaded to the draft is served as bytes by the preview and, published, by the live asset route',
    {
        when() {
            const l = lib()
            const revision = Number(
                ec.entity
                    .find('mantle.public.PublicTheme')
                    .condition({ themeId: state.themeId })
                    .disableAuthz()
                    .one().draftRevision,
            )
            const uploaded = l.run(T + 'store#ThemeAsset', {
                themeId: state.themeId,
                expectedRevision: revision,
                path: 'hero.png',
                contentBase64: PNG,
            })
            const previewed = preview().asset(
                SITE,
                PREVIEW_HOST,
                state.token,
                'hero.png',
            )
            l.setState(SITE, 'published')
            const { validationDigest } = l.run(T + 'validate#Theme', {
                themeId: state.themeId,
            })
            const published = l.run(T + 'publish#Theme', {
                operationKey: 'SHOPPRV-' + Date.now(),
                themeId: state.themeId,
                siteId: SITE,
                validationDigest,
                expectedActiveRevision: 0,
            })
            const shop = l.facade('getShopContext', { siteId: SITE }).result
            const live = theme().sendAsset(
                shop,
                published.manifestDigest,
                'hero.png',
            )
            return { uploaded, previewed, live }
        },
        then({ uploaded, previewed, live }) {
            uploaded.path === 'assets/hero.png'
            previewed.contentType === 'image/png'
            previewed.body.length === 70
            previewed.body[0] === 0x89
            live.contentType === 'image/png'
            live.text === PNG
        },
    },
)
