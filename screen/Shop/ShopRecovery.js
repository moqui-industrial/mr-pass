/* Shop's cart recovery link (Commerce P10; design-shop §6 Cart, §7.1, §13.2 recoverCart; design-commerce §6 RecoverCart). The
 * email's link is /Recover?r={token}: the token is kept in this server session (never in a page) and the page opened without
 * it, so it does not travel on as a referrer. The cart is a signed-in account's, so a visitor is asked to sign in (the token
 * stays kept); the signed-in shopper's Open my cart posts here and recoverCart spends the token: the authority rotates the
 * cart's capability into this session (kept as Shop/ShopCart.js keeps one), reprices it and names the lines that cannot be
 * bought now, and the cart page opens with that notice. A mail scanner's fetch of the link spends nothing. A spent, expired,
 * replaced or another account's link gets the not-available page. CC0 plus patent grant. */
const portal = () =>
    ec.resource.script('component://mr-pass/screen/Shared/Portal.js')
const carts = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopCart.js')
const account = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopAccount.js').helpers
const base = (context) => context.mount.base || ''
const linkKey = (siteId) => 'passShopRecovery:' + siteId
const session = () => {
    try {
        return ec.web?.sessionAttributes || null
    } catch (error) {
        return null
    }
}
const cleanToken = (value) =>
    String(value || '')
        .replace(/[^A-Za-z0-9_-]/g, '')
        .slice(0, 128)
const keptToken = (siteId) => {
    const value = session()?.[linkKey(siteId)]
    return value ? String(value) : ''
}
const drop = (siteId) => session()?.remove(linkKey(siteId))
function notAvailable(context) {
    const { esc, page } = account()
    return page(
        context,
        'Your cart',
        '<h1>Your cart</h1><p role="alert" id="RecoveryNotAvailable">This cart link is no longer available. It may have been used already, or it expired.</p><p><a href="' +
            esc(base(context) + '/Cart') +
            '">Open your cart</a> · <a href="' +
            esc(base(context) + '/') +
            '">Continue shopping</a></p>',
    )
}
/* Recover: with r, the token kept and the page opened without it; else the sign-in prompt or the Open my cart form. */
function render(context) {
    const { esc, page, signIn, formToken, takeNotice } = account()
    const siteId = context.site.siteId
    const presented = cleanToken(account().param('r'))
    if (presented) {
        const attributes = session()
        if (attributes) attributes[linkKey(siteId)] = presented
        return { redirect: base(context) + '/Recover' }
    }
    if (!keptToken(siteId)) return notAvailable(context)
    if (!ec.user.userId)
        return page(
            context,
            'Your cart',
            '<h1>Your saved cart</h1><div id="RecoverySignIn">' +
                signIn(context, '/Recover').replace(
                    'to see your purchases',
                    'to open the cart you saved',
                ) +
                '</div>',
        )
    return page(
        context,
        'Your cart',
        '<h1>Your saved cart</h1>' +
            takeNotice(siteId) +
            '<p>Open the cart you left. Its prices are checked again, and anything that cannot be bought now is named.</p>' +
            '<form method="post" id="RecoverCart" action="' +
            esc(base(context) + '/Recover/restore') +
            '">' +
            formToken() +
            '<button type="submit">Open my cart</button></form>',
    )
}
/* Recover/restore: recoverCart with the kept token; the cart's new capability kept, the cart page opened with the notice. */
function restore(context) {
    const siteId = context.site.siteId
    const token = keptToken(siteId)
    const response = ec.web?.response
    if (!token) return response?.sendRedirect(base(context) + '/Recover')
    const found = portal().attempt(
        'recoverCart',
        { siteId, token },
        { newTransaction: true },
    )
    if (found.error?.kind === 'AuthenticationRequired')
        return response?.sendRedirect(base(context) + '/Recover')
    drop(siteId)
    if (found.error) {
        account().notify(siteId, { kind: 'error', text: found.error.message })
        return response?.sendRedirect(base(context) + '/Recover')
    }
    carts().keep(siteId, found.result)
    const missing = found.result.unavailableItems || []
    carts().notify(siteId, {
        kind: 'ok',
        text:
            'Your cart is back, at today’s prices.' +
            (missing.length
                ? ' Not available now: ' + missing.join(', ') + '.'
                : ''),
    })
    response?.sendRedirect(base(context) + '/Cart')
}
;({ render, restore })
