// A remote frontend's caches and an authority outage (impl-shop P8, F63; design-shop §12.7): the site information Pass.xml
// reads on every page is kept for a visitor who is not signed in under the site's generation (read again when the generation
// moves, never for a signed-in visitor, never an answer that says its visitor is signed in); when the generation cannot be
// read nothing kept is served, so an authority that is down serves no page from the cache. The reads are Transport.js's
// read-through with stand-in authority reads, as ShopCatalog's catalog cache feature does.
const SITE = 'PASS_SHOP_OPS'
const transport = () =>
    ec.resource.script('component://mr-pass/service/pass/Transport.js')

spec({
    cleanup() {
        ec.cache.getCache('pass.shop.siteGenerations').remove(SITE)
        login('john.doe')
    },
})

feature(
    'site information is kept by generation for a visitor not signed in; an authority that cannot answer serves nothing kept',
    {
        when() {
            let fetches = 0
            let generation = 3
            let down = false
            const info =
                (extra = {}) =>
                () => {
                    if (down)
                        throw new Error(
                            'Unavailable: the authority is not answering',
                        )
                    fetches++
                    return {
                        site: { siteId: SITE, generation },
                        authenticated: false,
                        n: fetches,
                        ...extra,
                    }
                }
            const read = () => {
                if (down) throw new Error('Unavailable')
                return { generation, release: null }
            }
            const input = { siteId: SITE, hostname: 'ops.shop.example.test' }
            const through = (fetch) =>
                transport().readThrough('getSiteInfo', input, fetch, read).n
            const forget = () =>
                ec.cache.getCache('pass.shop.siteGenerations').remove(SITE)
            logout()
            const out = {}
            try {
                out.kept = [through(info()), through(info())]
                forget()
                generation = 4
                out.moved = through(info())
                // an answer naming a signed-in visitor is never kept
                forget()
                generation = 5
                out.signedInAnswer = [
                    through(info({ authenticated: true })),
                    through(info({ authenticated: true })),
                ]
                // the authority down: no generation, so nothing kept is served and the read fails as the page does
                forget()
                down = true
                try {
                    out.outage = through(info())
                } catch (error) {
                    out.outage = 'refused: ' + error.message
                }
                down = false
            } finally {
                login('john.doe')
            }
            forget()
            out.signedIn = [through(info()), through(info())]
            return out
        },
        then({ kept, moved, signedInAnswer, outage, signedIn }) {
            kept[0] == 1 && kept[1] == 1
            moved == 2
            signedInAnswer[0] == 3 && signedInAnswer[1] == 4
            outage.startsWith('refused: ')
            signedIn[0] == 5 && signedIn[1] == 6
        },
    },
)
