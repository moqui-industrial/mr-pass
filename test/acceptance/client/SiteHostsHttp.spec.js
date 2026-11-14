// Several sites by host name (docs/Deployment.md; the framework's plans/Edge-Node2.md §4.2 and §5 E14's acceptance): the
// Forum at the root of forum.sites.localhost (SITES_FORUM) and ZIZI_SHOP's Shop at the root of shop.sites.localhost, each
// host's root screen Pass.xml with the framework's routes refused (test/MoquiConf.xml, SiteHostsFixtures). Each host
// serves its app, Account and the shared static files; the site is the conf's whatever a request sends; /Login, /apps,
// /qapps, /rest, /status and /health are Not Found there and still answer on the server's other hosts; the session cookie
// is the host's own. Plain requests, no browser.
const FORUM = 'http://forum.sites.localhost:' + server.port
const SHOP = 'http://shop.sites.localhost:' + server.port
const OTHER = 'http://127.0.0.1:' + server.port
const plain = (url) => session().get(url)
spec({})
feature('the Forum at the root of its own host, with the site the conf binds', {
    when() {
        return {
            home: plain(FORUM + '/'),
            substituted: plain(FORUM + '/?siteId=ZIZI_SHOP&resolvedSiteId=ZIZI_SHOP'),
            signIn: plain(FORUM + '/account/Login'),
            script: plain(FORUM + '/js/MoquiLib.js'),
            unknown: plain(FORUM + '/NoSuchPage'),
        }
    },
    then({ home, substituted, signIn, script, unknown }) {
        home.status === 200
        home.text.includes('The forum has a host of its own')
        substituted.status === 200
        substituted.text.includes('The forum has a host of its own')
        signIn.status === 200
        signIn.headers('set-cookie').every((cookie) => !/domain=/i.test(cookie))
        script.status === 200
        unknown.status === 404
    },
})
feature('the Shop at the root of its own host', {
    when() {
        return {
            home: plain(SHOP + '/'),
            product: plain(SHOP + '/products/DEMO_1_1/demo-product-one-one'),
            signIn: plain(SHOP + '/account/Login'),
        }
    },
    then({ home, product, signIn }) {
        home.status === 200
        home.text.includes('href="/products/DEMO_1_1/demo-product-one-one"')
        product.status === 200
        signIn.status === 200
    },
})
feature("the framework's routes are Not Found on both hosts and answer on the others", {
    when() {
        const paths = ['/Login', '/apps', '/qapps', '/rest/s1/pass/v1/sites/SITES_FORUM/topics', '/status', '/health']
        const refused = []
        for (const base of [FORUM, SHOP])
            for (const path of paths) {
                const res = plain(base + path)
                if (res.status !== 404) refused.push(base + path + ' ' + res.status)
            }
        return { refused, login: plain(OTHER + '/Login') }
    },
    then({ refused, login }) {
        refused.length === 0
        login.status === 200
    },
})
