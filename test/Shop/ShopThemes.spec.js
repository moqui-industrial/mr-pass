// The Shop theme on PASS (impl-shop P2; design-shop §12.2-§12.5, §12.7): a draft from the starter theme validates and
// renders every page kind with its required components; published to a site, Shop's home is the release's own page
// (not the PASS shell) with the store's name, an empty state and its assets under the mount by digest; a section that
// fails is left out and the rest renders; a remote frontend renders the same release from files it verified, and one
// whose file does not match its digest shows the safe unavailable page; the manifest and files go only to a registered
// frontend.
const lib = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const theme = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopTheme.js')
const T = 'mantle.public.ThemeServices.'
const SITE = 'PASS_SHOP_THEME',
    HOST = 'theme.shop.example.test'
const state = {}
const draftFiles = (themeId) =>
    Object.fromEntries(
        lib()
            .run(T + 'get#ThemeDraft', { themeId, includeText: true })
            .files.map((file) => [file.path, file.text]),
    )
/* Validate a theme's draft and publish it to the spec's site over the active revision. */
function publish(themeId) {
    const l = lib()
    const { validationDigest, ok, diagnostics } = l.run(T + 'validate#Theme', {
        themeId,
    })
    const binding = ec.entity
        .find('mantle.public.PublicThemeBinding')
        .condition({ siteId: SITE })
        .disableAuthz()
        .one()
    const out = l.run(T + 'publish#Theme', {
        themeId,
        siteId: SITE,
        validationDigest,
        expectedActiveRevision: binding ? Number(binding.revision) : 0,
    })
    return { ok, diagnostics, ...out }
}
const context = () => lib().facade('getShopContext', { siteId: SITE }).result
/* A remote frontend's authority call: the authority's answer to the registered client, through the transport. */
function remoteCall(operation, input) {
    const out = lib().remote(operation, input)
    if (out.result === undefined) {
        const error = new Error(out.message || out.kind)
        error.moquiErrorKind = out.kind
        throw error
    }
    return out.result
}
spec({
    setupSpec() {
        login('john.doe')
        const l = lib()
        l.records()
        l.site(SITE, HOST)
        l.mounts(SITE, [
            { app: 'account', pathPrefix: '/account' },
            { app: 'shop', pathPrefix: '/shop', targetId: l.ids.store },
        ])
        l.setState(SITE, 'published')
        setProperty(
            'pass_client_' + l.ids.client + '_secret',
            'pass-shop-spec-secret',
        )
        setProperty('pass_client_' + l.ids.client + '_sites', SITE)
        state.themeId = l.run(T + 'create#ThemeDraft', {
            productStoreId: l.ids.store,
            starter: 'mr-pass/starter',
        }).themeId
    },
    cleanup() {
        login('john.doe')
    },
})
feature(
    'a draft from the starter validates and renders every page kind with its required components',
    {
        when() {
            const validated = lib().run(T + 'validate#Theme', {
                themeId: state.themeId,
            })
            const files = draftFiles(state.themeId)
            const themes = ec.resource.script(
                'component://mr-mantle/service/mantle/public/Themes.js',
            )
            const pages = {}
            for (const kind of themes.pageKinds) {
                const components = Object.fromEntries(
                    Object.entries(theme().COMPONENTS)
                        .filter(([, c]) => c.kinds.includes(kind))
                        .map(([name]) => [
                            name,
                            { html: '<b id="C' + kind + '">' + name + '</b>' },
                        ]),
                )
                const rendered = ec.resource.theme.render(
                    { files },
                    {
                        pageKind: kind,
                        view: {
                            site: { displayName: 'Spec site', locale: 'en' },
                            shop: { name: 'Spec store', baseUrl: '/shop' },
                            locale: 'en',
                            page: { kind, title: 'Spec ' + kind },
                            navigation: [{ label: 'Home', url: '/shop' }],
                            productList: [],
                            product: { id: 'P1', name: 'Mug' },
                            category: { id: 'C1', name: 'Cups' },
                        },
                        components,
                        assetBase: '/shop/theme/x',
                    },
                )
                pages[kind] = {
                    ok: rendered.ok,
                    placed:
                        !Object.keys(components).length ||
                        rendered.html.includes('id="C' + kind + '"'),
                    title: rendered.html.includes('<main id="main">'),
                }
            }
            return {
                validated,
                pages,
                fileCount: Object.keys(files).length,
                // PASS's trusted components are the authority's required ones, on the same page kinds
                parity:
                    JSON.stringify(
                        Object.fromEntries(
                            Object.entries(theme().COMPONENTS).map(
                                ([name, c]) => [name, c.kinds],
                            ),
                        ),
                    ) === JSON.stringify(themes.requiredComponents),
            }
        },
        then({ validated, pages, fileCount, parity }) {
            validated.ok === true
            validated.diagnostics.length === 0
            fileCount > 30
            parity
            Object.keys(pages).length === 13
            Object.values(pages).every((p) => p.ok && p.placed && p.title)
        },
    },
)
feature(
    'published to the site, home is the release’s own page with the store’s name, an empty state and its assets by digest',
    {
        when() {
            const l = lib()
            const before = Number(l.siteRow(SITE).generation)
            const published = publish(state.themeId)
            state.first = published
            const shop = context()
            const home = l.render(SITE, HOST, '/shop', 'Shop')
            const css = theme().sendAsset(
                shop,
                published.manifestDigest,
                'store.css',
            )
            const svg = theme().sendAsset(
                shop,
                published.manifestDigest,
                'logo.svg',
            )
            const refused = (digest, path) => {
                try {
                    theme().sendAsset(shop, digest, path)
                    return 'served'
                } catch (error) {
                    return error.moquiErrorKind
                }
            }
            return {
                published,
                shop,
                home,
                css,
                svg,
                wrongDigest: refused('0'.repeat(64), 'store.css'),
                notAsset: refused(published.manifestDigest, '../theme.json'),
                route: l.route(
                    SITE,
                    HOST,
                    '/shop/theme/' + published.manifestDigest + '/store.css',
                ),
                badRoute: l.route(SITE, HOST, '/shop/theme/abc/store.css'),
                generation: Number(l.siteRow(SITE).generation) - before,
            }
        },
        then({
            published,
            shop,
            home,
            css,
            svg,
            wrongDigest,
            notAsset,
            route,
            badRoute,
            generation,
        }) {
            published.revision === 1
            generation === 1
            shop.release.releaseId === published.releaseId
            home.errors.length === 0
            // the theme's document is the whole page (the test render adds its screen boundary comments)
            home.html
                .replace(/<!--[^]*?-->\s*/g, '')
                .startsWith('<!doctype html>')
            home.html.includes('<h1>Shop Spec Store</h1>')
            home.html.includes('id="ShopEmpty"')
            home.html.includes(
                'href="/shop/theme/' + published.manifestDigest + '/store.css"',
            )
            !home.html.includes('IronStone PASS')
            !home.html.includes('moquiSessionToken')
            css.contentType === 'text/css'
            css.text.includes('.store-header')
            svg.contentType === 'image/svg+xml'
            svg.text.startsWith('<svg')
            wrongDigest === 'NotFound'
            notAsset === 'NotFound'
            route === '/Shop/themeAsset'
            badRoute === 'refused:NotFound'
        },
    },
)
feature('an optional section that fails is left out and the rest renders', {
    when() {
        const l = lib()
        const themes = ec.resource.script(
            'component://mr-mantle/service/mantle/public/Themes.js',
        )
        const failing = l.run(T + 'create#ThemeDraft', {
            productStoreId: l.ids.store,
            releaseId: state.first.releaseId,
        }).themeId
        const row = ec.entity
            .find('mantle.public.PublicTheme')
            .condition({ themeId: failing })
            .disableAuthz()
            .one()
        themes.putDraftFiles(
            row,
            {
                'sections/hero.html.fancy-locked':
                    '<section class="store-hero">${section.settings.missing.deeper}</section>',
            },
            'spec',
        )
        const published = publish(failing)
        const page = theme().renderPage(context(), 'home')
        return { published, page }
    },
    then({ published, page }) {
        published.ok === true
        published.diagnostics.some(
            (d) => d.severity === 'warning' && d.section === 'hero',
        )
        page.ok === true
        page.omitted.length === 1
        page.omitted[0].section === 'hero'
        page.html.includes('<section class="store-hero"></section>')
        !page.html.includes('missing')
        page.html.includes('id="ShopEmpty"')
    },
})
feature(
    'a remote frontend renders the same release from verified files; a file that does not match shows the unavailable page',
    {
        when() {
            const shop = context()
            const local = theme().renderPage(shop, 'home')
            ec.cache.getCache('pass.shop.themeReleases').clear()
            const far = theme().renderPage(shop, 'home', remoteCall)
            ec.cache.getCache('pass.shop.themeReleases').clear()
            const forged = theme().renderPage(shop, 'home', (op, input) => {
                const out = remoteCall(op, input)
                if (op === 'getShopThemeFiles')
                    out.files[0].text = out.files[0].text + ' '
                return out
            })
            ec.cache.getCache('pass.shop.themeReleases').clear()
            // the manifest and files go only to a registered frontend, never to a browser's call
            const asked = { siteId: SITE, releaseId: local.releaseId }
            const browser = lib().remote('getShopThemeRelease', asked, {
                clientId: '',
                clientVerified: false,
            })
            const files = lib().remote(
                'getShopThemeFiles',
                { ...asked, paths: 'theme.json' },
                { clientId: '', clientVerified: false },
            )
            const registered = lib().remote('getShopThemeRelease', asked)
            return { local, far, forged, browser, files, registered }
        },
        then({ local, far, forged, browser, files, registered }) {
            far.html === local.html
            far.releaseId === local.releaseId
            forged.status === 503
            forged.html.includes('id="ShopUnavailable"')
            forged.html.includes('Shop Spec Store is not available right now')
            browser.kind === 'NotFound'
            files.kind === 'NotFound'
            registered.result.releaseId === local.releaseId
        },
    },
)
