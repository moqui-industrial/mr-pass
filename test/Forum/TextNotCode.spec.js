// OWASP ASVS 5.0.0 v5.0.0-1.3.2, PASS's in-process proof (docs/ASVS-Matrix.md, V1): what a member writes is text, never
// code. A post whose title and body hold the expression syntaxes of the engines PASS's pages and mail pass through (the
// .html.fancy templates' ${} and <#if>, Vue's {{ }}, #{}) and a script is published through PASS's facade
// (pass.Facade.call#Operation, as the pages call it), read back through it, and found by the Forum's search page, which
// shows its title and an excerpt of its body. An expression run would show 71337.
// Does not prove: the Shop theme renderer (its own ${} runs only in the locked renderer, mr-mantle ThemeAuthoring), nor
// the other apps' fields; mr-pass loads only fixed component:// scripts, which no test can show.
const S = 'mantle.public.SiteServices.',
    F = 'mantle.forum.ForumServices.'
const HOST = 'text-not-code.example.test'
const EXPRESSIONS = '${70000+1337} {{70000+1337}} #{70000+1337}'
const run = (service, input) => call(service, { input }).result
const pass = (operation, input) => call('pass.Facade.call#Operation', { operation, input }).result
spec({
    setupSpec() {
        login('john.doe')
    },
})
feature("v5.0.0-1.3.2: a post's expressions and template directives stay text when saved, read and shown", {
    when() {
        const siteId = run(S + 'create#Site', { name: 'PASS text not code', ownerPartyId: ec.user.userAccount.partyId }).siteId
        run(S + 'update#Site', { siteId, state: 'published', name: 'PASS text not code', expectedRevision: 1 })
        run(S + 'store#Mounts', {
            siteId,
            expectedRevision: 2,
            mounts: [{ app: 'forum', pathPrefix: '/forum' }],
            hosts: [{ hostname: HOST, canonical: true }],
        })
        const contactListId = run(F + 'store#Category', { siteId, name: 'Probes', operationId: ec.user.randomString(32) })
            .contactListId
        run(F + 'set#CategoryAccess', {
            siteId,
            contactListId,
            visibility: 'public',
            publicationState: 'published',
            confirm: true,
            expectedRevision: 1,
        })
        const title = `Probe zqnoeval ${EXPRESSIONS} <#if true>RAN</#if>`
        const posted = pass('publishPost', {
            siteId,
            contactListId,
            title,
            body: `<p>Body ${EXPRESSIONS} <#if true>RAN</#if></p><script>window.ran = 71337</script>`,
            operationId: 'text-not-code-001',
        })
        const topic = pass('getTopic', { siteId, rootCommEventId: posted.rootCommEventId }).topic
        const body = pass('getPosts', { siteId, rootCommEventId: posted.rootCommEventId }).postList[0].body
        const rendered = ec.screen
            .makeTest()
            .rootScreen('component://mr-pass/screen/Pass.xml')
            .render('Forum/Search', { resolvedSiteId: siteId, publicHost: HOST, publicPath: '/forum/Search', query: 'zqnoeval' }, null)
        return { title, topic, body, html: rendered.output, errors: rendered.errorMessages }
    },
    then({ title, topic, body, html, errors }) {
        topic.title === title
        body.includes(EXPRESSIONS)
        !body.includes('<script')
        !body.includes('71337')
        errors.length === 0
        // the control: the search found the post, and the page shows its title and its body's text
        html.includes(`Probe zqnoeval ${EXPRESSIONS} &lt;#if true&gt;RAN&lt;/#if&gt;`)
        html.includes(`Body ${EXPRESSIONS}`)
        !html.includes('71337')
    },
})
