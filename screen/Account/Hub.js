/* The PASS Account hub and email preferences pages (impl-shop P6, F6; design-shop §9 Shared account screens, design-forum §8,
 * X6, X15), the PASS Account foundation's: Home shows one card per app the site mounts that registers one (getAccountHub:
 * Shop's AccountOverview summary, Billing's invoices, Support's cases and returns); EmailPreferences combines a list link's
 * unsubscribe (its token from ConsentServices' link, /EmailPreferences?token=, with RFC 8058's one-click POST), the
 * signed-in account's lists and each store's cart reminders topic (getEmailPreferences, storeEmailPreferences), and the
 * Forum opt-out's page. Plain forms; no-store. CC0 plus patent grant. */
const portal = () =>
    ec.resource.script('component://mr-pass/screen/Shared/Portal.js')
const esc = (text) =>
    String(text ?? '').replace(
        /[&<>"']/g,
        (c) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[c],
    )
const param = (name) => {
    const value = ec.web?.parameters?.[name]
    if (value == null) return null
    if (typeof value === 'object' && value.length != null)
        return value.length ? String(value[0]) : null
    return String(value)
}
const tokenParam = () =>
    String(param('token') || '')
        .replace(/[^A-Za-z0-9_-]/g, '')
        .slice(0, 128)
const hidden = (name, value) =>
    '<input type="hidden" name="' + name + '" value="' + esc(value ?? '') + '">'
const formToken = () =>
    ec.web ? hidden('moquiSessionToken', ec.web.sessionToken) : ''
const loginLink = (path) =>
    '<p><a href="' +
    esc(
        (ec.context.get('passBases')?.account ?? '/account') +
            '/Login?returnTo=' +
            encodeURIComponent(path),
    ) +
    '">Sign in</a></p>'
function flash() {
    const attributes = ec.web?.sessionAttributes
    const text = attributes?.passAccountNotice
    if (!text) return ''
    attributes.remove('passAccountNotice')
    return '<p role="status" class="card">' + esc(text) + '</p>'
}

/* Home: the account's cards. */
function home(siteId, publicPath) {
    const found = portal().attempt('getAccountHub', { siteId })
    if (found.error)
        return (
            '<h1>My account</h1><p role="alert">' +
            esc(found.error.message) +
            '</p>' +
            (found.error.kind === 'AuthenticationRequired'
                ? loginLink(publicPath)
                : '')
        )
    const hub = found.result
    const cards = hub.cards
        .map(
            (card) =>
                '<section class="card" id="AccountCard_' +
                esc(card.app) +
                '" aria-labelledby="AccountCardTitle_' +
                esc(card.app) +
                '"><h2 id="AccountCardTitle_' +
                esc(card.app) +
                '">' +
                (card.url
                    ? '<a href="' +
                      esc(card.url) +
                      '">' +
                      esc(card.title) +
                      '</a>'
                    : esc(card.title)) +
                '</h2>' +
                (card.lines || [])
                    .map((line) => '<p>' + esc(line) + '</p>')
                    .join('') +
                (card.links || [])
                    .map(
                        (link) =>
                            '<a href="' +
                            esc(link.url) +
                            '">' +
                            esc(link.text) +
                            '</a>',
                    )
                    .join(' · ') +
                '</section>',
        )
        .join('')
    return (
        '<h1>My account</h1><p>' +
        esc(hub.account.name) +
        (hub.account.emailAddress
            ? ' · ' + esc(hub.account.emailAddress)
            : '') +
        '</p>' +
        (cards || '<p>Nothing here yet.</p>') +
        '<nav class="card" aria-label="Account settings"><a href="' +
        esc(hub.links.settings) +
        '">Profile and security</a> · <a href="' +
        esc(hub.links.emailPreferences) +
        '">Email preferences</a></nav>'
    )
}

/* EmailPreferences: the lists and topics, each a checkbox, saved together. */
function preferences(siteId, publicPath) {
    const token = tokenParam()
    const found = portal().attempt('getEmailPreferences', {
        siteId,
        ...(token ? { token } : {}),
    })
    if (found.error)
        return (
            '<h1>Email preferences</h1><p role="alert">' +
            esc(found.error.message) +
            '</p>' +
            (found.error.kind === 'AuthenticationRequired'
                ? loginLink(publicPath)
                : '')
        )
    const v = found.result
    const box = (name, checked, label, description) =>
        '<label><input type="checkbox" name="' +
        name +
        '" value="true"' +
        (checked ? ' checked' : '') +
        '> ' +
        esc(label) +
        '</label>' +
        (description ? '<p><small>' + esc(description) + '</small></p>' : '') +
        hidden(name + '__shown', 'true')
    const lists = v.lists
        .map((list) =>
            box(
                'list_' + list.contactListId,
                list.subscribed,
                list.name,
                list.description,
            ),
        )
        .join('')
    const topics = (v.topics || [])
        .map((topic) =>
            box(
                'topic_' + topic.topicId,
                topic.on,
                topic.name,
                topic.description,
            ),
        )
        .join('')
    return (
        '<h1>Email preferences</h1>' +
        flash() +
        (v.mode === 'token'
            ? '<p>Email from ' +
              esc(v.organizationName) +
              ' to ' +
              esc(v.maskedAddress) +
              '</p>'
            : '<p>' + esc(v.emailAddress) + '</p>') +
        '<form method="post" class="card" id="EmailPreferencesForm" action="' +
        esc(publicPath + '/save') +
        '">' +
        formToken() +
        (token ? hidden('token', token) : '') +
        (lists
            ? '<fieldset><legend>Lists</legend>' + lists + '</fieldset>'
            : '') +
        (topics
            ? '<fieldset><legend>Store emails</legend>' + topics + '</fieldset>'
            : '') +
        (v.mode === 'token'
            ? '<label><input type="checkbox" name="unsubscribeAll" value="true"> No marketing email at all</label>'
            : '') +
        (lists || topics || v.mode === 'token'
            ? '<p><button type="submit">Save preferences</button></p>'
            : '<p>You are on no lists.</p>') +
        '</form>' +
        (v.forumUrl
            ? '<p><a href="' + esc(v.forumUrl) + '">Forum email</a></p>'
            : '')
    )
}
/* EmailPreferences/save: the checked lists and topics (an unchecked one shown on the page is off). */
function save(siteId, publicPath) {
    const parameters = ec.web.parameters
    const lists = {}
    const topics = {}
    for (const name of Object.keys(parameters)) {
        const shown = /^(list|topic)_(.{1,80})__shown$/.exec(name)
        if (!shown) continue
        const on = param(shown[1] + '_' + shown[2]) === 'true'
        if (shown[1] === 'list') lists[shown[2]] = on
        else topics[shown[2]] = on
    }
    const token = tokenParam()
    const found = portal().attempt('storeEmailPreferences', {
        siteId,
        ...(token ? { token } : {}),
        choices: JSON.stringify({
            lists,
            topics,
            unsubscribeAll: param('unsubscribeAll') === 'true',
        }),
    })
    ec.web.sessionAttributes.passAccountNotice = found.error
        ? found.error.message
        : 'Your preferences are saved.'
    const back = publicPath.replace(/\/save$/, '')
    ec.web.response.sendRedirect(
        back + (token ? '?token=' + encodeURIComponent(token) : ''),
    )
}
/* EmailPreferences/oneClick: RFC 8058's POST to a list link: the token's list unsubscribed, answered as JSON. */
function oneClick(siteId) {
    const found = portal().attempt('applyOneClickUnsubscribe', {
        siteId,
        token: tokenParam(),
    })
    ec.web.response.setStatus(found.error ? 404 : 200)
    ec.web.response.setContentType('application/json;charset=UTF-8')
    ec.web.response.write(
        JSON.stringify(found.error ? { ok: false } : { ok: true }),
    )
}
;({ home, preferences, save, oneClick })
