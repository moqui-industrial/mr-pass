// Several sites by host name (docs/Deployment.md; the framework's plans/Edge-Node2.md §4.2, E14), the data of
// client/SiteHostsHttp: SITES_FORUM, a published community with the Forum at the root of forum.sites.localhost and one
// published topic, and shop.sites.localhost as a second host of ZIZI_SHOP (ShopFixtures), whose Shop is at its root. The
// hosts' root screens and public-site bindings are in test/MoquiConf.xml. Each record is made once.
const SITE = 'SITES_FORUM',
    HOST = 'forum.sites.localhost'
const one = (entity, fields) =>
    ec.entity.find(entity).condition(fields).disableAuthz().one()
spec({
    dependsOn: ['ShopFixtures'],
    setupSpec() {
        login('john.doe')
        ec.artifactExecution.disableAuthz()
    },
    cleanupSpec() {
        ec.artifactExecution.enableAuthz()
    },
})
feature('provision a community with the Forum at the root of its own host', {
    when() {
        if (one('mantle.public.PublicSite', { siteId: SITE }))
            return { state: 'published' }
        const partyId = ec.user.userAccount.partyId
        call('create#mantle.public.PublicSite', {
            siteId: SITE,
            name: 'Forum at its own host',
            state: 'published',
            registrationMode: 'closed',
            locale: 'en',
            timeZone: 'UTC',
            policyRevision: 1,
            generation: 1,
        })
        call('create#mantle.public.PublicSiteParty', {
            siteId: SITE,
            partyId,
            state: 'active',
            role: 'owner',
            revision: 1,
        })
        const run = (service, input) => call(service, { input }).result
        run('mantle.public.SiteServices.store#Mounts', {
            siteId: SITE,
            expectedRevision: 1,
            mounts: [
                { app: 'forum', pathPrefix: '/' },
                { app: 'account', pathPrefix: '/account' },
            ],
            hosts: [{ hostname: HOST, canonical: true }],
        })
        const category = run('mantle.forum.ForumServices.store#Category', {
            siteId: SITE,
            name: 'Announcements',
            operationId: ec.user.randomString(32),
        })
        run('mantle.forum.ForumServices.set#CategoryAccess', {
            siteId: SITE,
            contactListId: category.contactListId,
            visibility: 'public',
            publicationState: 'published',
            confirm: true,
            expectedRevision: 1,
        })
        return run('mantle.forum.ForumServices.publish#Post', {
            siteId: SITE,
            contactListId: category.contactListId,
            title: 'The forum has a host of its own',
            body: '<p>Served at the root of forum.sites.localhost.</p>',
            operationId: 'site-hosts-fixture-001',
        })
    },
    then(result) {
        result.state === 'published'
    },
})
feature('give ZIZI_SHOP a second host', {
    when() {
        if (!one('mantle.public.PublicSiteHost', { hostname: 'shop.sites.localhost' }))
            call('create#mantle.public.PublicSiteHost', {
                hostname: 'shop.sites.localhost',
                siteId: 'ZIZI_SHOP',
                canonical: 'N',
            })
        return one('mantle.public.PublicSiteHost', { hostname: 'shop.sites.localhost' })
    },
    then(host) {
        host.siteId === 'ZIZI_SHOP'
    },
})
