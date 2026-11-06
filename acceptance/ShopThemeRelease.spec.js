// Shop P2's "usable when" (impl-shop P2; design-shop §12.2-§12.5, §12.7): the starter theme publishes to ZIZI_SHOP and
// its home renders the store's name and an empty state; a section that loops forever stops at its budget and is left
// out; a template naming `ec` fails validation and cannot be published; a remote frontend (the authority's answers as the
// transport takes them) renders the same release after checking its digests. ZIZI_SHOP is Commerce's demo site (mr-boss
// Demo.js); without BOSS the spec makes it as the demo does, with Shop at its root for POPC_DEFAULT. The site's state is
// put back after; the published starter stays, as the demo's mount does.
const lib = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const theme = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopTheme.js')
const themes = () =>
    ec.resource.script('component://mr-mantle/service/mantle/public/Themes.js')
const T = 'mantle.public.ThemeServices.'
const SITE = 'ZIZI_SHOP',
    HOST = 'shop.zizi.localhost',
    STORE = 'POPC_DEFAULT',
    ORG = 'ORG_ZIZI_RETAIL'
const state = {}
const revision = () => {
    const binding = ec.entity
        .find('mantle.public.PublicThemeBinding')
        .condition({ siteId: SITE })
        .disableAuthz()
        .one()
    return binding ? Number(binding.revision) : 0
}
/* An operation key of its own for each publish or restore (PostingOperation). */
const opKey = () =>
    'SHOPTHM-' + Date.now() + '-' + Math.floor(Math.random() * 1e6)
function publish(themeId) {
    const l = lib()
    const validated = l.run(T + 'validate#Theme', { themeId })
    const published = l.run(T + 'publish#Theme', {
        operationKey: opKey(),
        themeId,
        siteId: SITE,
        validationDigest: validated.validationDigest,
        expectedActiveRevision: revision(),
    })
    return { validated, published }
}
/* A draft copied from a release with some files changed (Commerce P5's editors write drafts the same way). */
function variant(releaseId, changes) {
    const l = lib()
    const themeId = l.run(T + 'create#ThemeDraft', {
        productStoreId: STORE,
        releaseId,
    }).themeId
    const row = ec.entity
        .find('mantle.public.PublicTheme')
        .condition({ themeId })
        .disableAuthz()
        .one()
    themes().putDraftFiles(row, changes, 'acceptance')
    return themeId
}
const context = () => lib().facade('getShopContext', { siteId: SITE }).result
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
        if (!l.siteRow(SITE)) {
            l.site(SITE, HOST, {
                name: 'Ziziwork Retail Store',
                registrationMode: 'open',
                approvalRequired: 'N',
                timeZone: 'America/Chicago',
            })
            for (const [app, targetId] of [
                ['account', null],
                ['billing', ORG],
                ['support', ORG],
            ])
                l.run('create#mantle.public.PublicSiteApp', {
                    siteId: SITE,
                    appMountId: app,
                    app,
                    pathPrefix: '/' + app,
                    enabled: 'Y',
                    targetId,
                })
        }
        const mounts = Array.from(
            ec.entity
                .find('mantle.public.PublicSiteApp')
                .condition({ siteId: SITE })
                .disableAuthz()
                .list(),
        )
        if (!mounts.some((m) => m.app === 'shop'))
            l.mounts(SITE, [
                ...mounts
                    .filter((m) => !['billing', 'support'].includes(m.app))
                    .map((m) => ({ app: m.app, pathPrefix: m.pathPrefix })),
                { app: 'shop', pathPrefix: '/', targetId: STORE },
            ])
        state.before = l.siteRow(SITE).state
        l.setState(SITE, 'published')
        state.storeName = ec.entity
            .find('mantle.product.store.ProductStore')
            .condition({ productStoreId: STORE })
            .disableAuthz()
            .one().storeName
        state.path =
            l.facade('getShopContext', { siteId: SITE }).result.mount.base || ''
        setProperty(
            'pass_client_' + l.ids.client + '_secret',
            'pass-shop-theme-secret',
        )
        setProperty('pass_client_' + l.ids.client + '_sites', SITE)
    },
    cleanupSpec() {
        login('john.doe')
        lib().setState(SITE, state.before)
    },
})
feature(
    'the starter publishes to ZIZI_SHOP and its home renders the store’s name and an empty state',
    {
        when() {
            const l = lib()
            const themeId = l.run(T + 'create#ThemeDraft', {
                productStoreId: STORE,
                starter: 'mr-pass/starter',
            }).themeId
            const { validated, published } = publish(themeId)
            state.starter = published
            logout()
            const home = l.render(SITE, HOST, state.path + '/', 'Shop')
            login('john.doe')
            return { validated, published, home }
        },
        then({ validated, published, home }) {
            validated.ok === true
            published.revision === revision()
            home.errors.length === 0
            home.html.includes('<h1>' + state.storeName + '</h1>')
            home.html.includes('id="ShopEmpty"')
            home.html.includes(
                '/theme/' + published.manifestDigest + '/store.css',
            )
            !home.html.includes('IronStone PASS')
        },
    },
)
feature('a section that loops forever stops at its budget and is left out', {
    when() {
        const themeId = variant(state.starter.releaseId, {
            // catastrophic backtracking: runs for ever without allocating
            'sections/hero.html.fancy-locked':
                "<section class=\"store-hero\">${/(a+)+$/.test('a'.repeat(60) + 'b')}</section>",
        })
        const { validated, published } = publish(themeId)
        const started = Date.now()
        const page = theme().renderPage(context(), 'home')
        const took = Date.now() - started
        const back = lib().run(T + 'restore#ThemeRelease', {
            operationKey: opKey(),
            siteId: SITE,
            releaseId: state.starter.releaseId,
            expectedActiveRevision: revision(),
        })
        return { validated, published, page, took, back }
    },
    then({ validated, published, page, took, back }) {
        validated.ok === true
        validated.diagnostics.some(
            (d) => d.section === 'hero' && /budget/.test(d.message),
        )
        published.releaseId != null
        page.ok === true
        page.omitted.some(
            (o) => o.section === 'hero' && /time budget/.test(o.reason),
        )
        page.html.includes('id="ShopEmpty"')
        took < 3000
        back.releaseId === state.starter.releaseId
    },
})
feature(
    'a template naming ec fails validation with its file and line and cannot be published',
    {
        when() {
            const themeId = variant(state.starter.releaseId, {
                'sections/hero.html.fancy-locked':
                    '<section class="store-hero">\n<h1>${ec.user.username}</h1>\n</section>',
            })
            const validated = lib().run(T + 'validate#Theme', { themeId })
            let refused = ''
            try {
                lib().run(T + 'publish#Theme', {
                    operationKey: opKey(),
                    themeId,
                    siteId: SITE,
                    validationDigest: validated.validationDigest,
                    expectedActiveRevision: revision(),
                })
            } catch (error) {
                refused = String(error.message)
            }
            ec.message.clearErrors()
            return { validated, refused }
        },
        then({ validated, refused }) {
            validated.ok === false
            validated.diagnostics.some(
                (d) =>
                    d.code === 'forbidden-name' &&
                    d.file === 'sections/hero.html.fancy-locked' &&
                    d.line === 2,
            )
            refused.includes('THEME_INVALID')
        },
    },
)
feature(
    'a remote frontend renders the same release after checking its digests',
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
                    out.files[out.files.length - 1].text += '\n'
                return out
            })
            ec.cache.getCache('pass.shop.themeReleases').clear()
            return { local, far, forged }
        },
        then({ local, far, forged }) {
            far.html === local.html
            far.releaseId === state.starter.releaseId
            forged.status === 503
            forged.html.includes('id="ShopUnavailable"')
        },
    },
)
