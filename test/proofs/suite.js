// PASS's security proofs (moqui test-client mr-pass --proofs), filed by OWASP ASVS 5.0.0 requirement: the rows of
// docs/ASVS-Matrix.md whose status is PASS. With --serve they run against the server test/client runs against, mr-pass
// under the load test conf (the production conf with the tarpits off), with test/MoquiConf.xml's sites and the data of
// ClientFixtures, PortalFixtures and ShopWalkFixtures; against any other server in the deployment profile, where a proof
// that needs an account takes --param user=NAME (its password in MOQUI_TEST_PASSWORD) and one that needs fixture data
// skips. matrix is the matrix the run's summary (proofs.json, proofs.md) joins its results to, relative to this
// component's directory.
suite(['V3WebFrontend', 'V6Authentication', 'V7SessionManagement'], {
    server: {
        components: ['mr-pass'],
        specs: ['ClientFixtures', 'PortalFixtures', 'ShopWalkFixtures'],
        conf: 'conf/MoquiLoadTestConf.xml',
    },
    matrix: 'docs/ASVS-Matrix.md',
})
