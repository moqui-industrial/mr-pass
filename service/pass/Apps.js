/* CC0 plus patent grant.
 * The PASS apps this frontend serves: each app's root screen under Pass.xml and its default base path. The authority keeps
 * the same app names (mr-mantle service/mantle/public/PublicApps.js), with which apps take a target; a site's mounts
 * (PublicSiteApp) and the runtime's <public-site> mounts choose the paths. A new app adds itself here, as a subscreen of
 * Pass.xml and in both registries (docs/Deployment.md "Adding an app").
 */
;({
    forum: { screen: 'Forum', base: '/forum' },
    account: { screen: 'Account', base: '/account' },
    members: { screen: 'Members', base: '/members' },
    sites: { screen: 'Sites', base: '/sites' },
    billing: { screen: 'Billing', base: '/billing' },
    supplier: { screen: 'Supplier', base: '/supplier' },
    // Customer Service P13: the Support app (its Feedback page; P15 the rest)
    support: { screen: 'Support', base: '/support' },
    // Shop (impl-shop P1): a ProductStore's storefront, mounted at /shop or at a site's root
    shop: { screen: 'Shop', base: '/shop' },
})
