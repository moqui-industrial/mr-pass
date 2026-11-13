// Shop P3's remote frontend (impl-shop P3; ShopRemoteHttp): run only in the dedicated remote frontend runtime (framework,
// webroot and PASS, with pass_backend_url naming an authority that serves ShopFixtures; docs/Deployment.md "Reproducing the
// remote check"). The frontend has no Mantle entity catalog, and reads the demo Shop sites' context from the authority.
const remote = !!System.getProperty('pass_backend_url')
feature(
    'the remote frontend has no Mantle catalog and reads the demo Shop sites from its authority',
    {
        ignore: remote
            ? false
            : 'Requires the dedicated remote frontend runtime',
        when() {
            const context = (siteId) =>
                ec.service
                    .sync()
                    .name('pass.Facade.call#Operation')
                    .parameters({
                        operation: 'getShopContext',
                        input: { siteId },
                    })
                    .call().result
            return {
                mantle: ec.entity.isEntityDefined('mantle.product.Product'),
                shop: context('ZIZI_SHOP'),
                digital: context('ZIZI_DIGITAL'),
            }
        },
        then({ mantle, shop, digital }) {
            mantle === false
            shop.store.productStoreId === 'POPC_DEFAULT'
            shop.release != null
            digital.store.productStoreId === 'BOSS_COM_DIGITAL'
        },
    },
)
