/* Shop's subscription pages (impl-shop P7; design-shop §10 Subscriptions, SubscriptionDetail). The authority keeps every
 * record (Mantle's ShopSubscriptionServices); these pages are a signed-in verified buyer's, through the account pages'
 * helpers (Shop/ShopAccount.js), and render through the active release's checkout page kind or the PASS shell.
 *
 * - Subscriptions (/Subscriptions): each subscription's billing and access apart (a cancelled renewal keeps access to the
 *   paid term) and the store's offers; Subscribe begins the purchase and goes on to the checkout, which asks for the
 *   renewal consent of an automatic offer. PublicSite.subscriptionUrl points here (the Forum's "Manage your subscription").
 * - SubscriptionDetail (/Subscriptions/{contractId}): the plan, card and consent, the history of the purchase and each
 *   renewal, and the forms ChangeMethod (another kept card with consent), CancelRenewal (confirmed, at the revision),
 *   ResolveRenewal (charge a waiting renewal again) and RenewPrepaid (another prepaid term).
 * CC0 plus patent grant. */
const account = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopAccount.js')
const h = () => account().helpers
const base = (context) => context.mount.base || ''
const esc = (text) => h().esc(text)
const money = (value) => (value ? esc(value.display) : '')
const cleanId = (value) =>
    String(value || '')
        .replace(/[^A-Za-z0-9_-]/g, '')
        .slice(0, 40)
const form = (context, path, fields, button, extra) =>
    '<form method="post" action="' +
    esc(base(context) + '/Subscriptions/' + path) +
    '">' +
    h().formToken() +
    h().hidden(
        'operationId',
        ec.user.randomString(20).replace(/[^A-Za-z0-9]/g, 'x'),
    ) +
    fields +
    '<button type="submit"' +
    (extra || '') +
    '>' +
    esc(button) +
    '</button></form>'
const refusal = (context, title, found, path) =>
    h().page(
        context,
        title,
        '<h1>' +
            esc(title) +
            '</h1><p role="alert">' +
            esc(found.error.message) +
            '</p>' +
            (found.error.kind === 'AuthenticationRequired'
                ? h().signIn(context, path)
                : ''),
    )
const stateLine = (s) =>
    '<p><strong>' +
    esc(s.billingText) +
    '</strong> · ' +
    esc(s.accessText) +
    (s.nextRenewalText
        ? ' · Next charge ' +
          money(s.nextAmount) +
          ' on ' +
          esc(s.nextRenewalText)
        : '') +
    (s.cancelAtText ? ' · Ends ' + esc(s.cancelAtText) : '') +
    '</p>'

/* ---- Subscriptions ---- */
function listPage(context) {
    const found = h().attempt(context, 'getSubscriptions', {})
    if (found.error)
        return refusal(context, 'Your subscriptions', found, '/Subscriptions')
    const items = found.result.subscriptions
        .map(
            (s) =>
                '<li><h2><a href="' +
                esc(base(context) + '/Subscriptions/' + s.contractId) +
                '">' +
                esc(s.name) +
                '</a></h2><p>' +
                money(s.price) +
                ' every ' +
                esc(s.termText) +
                '</p>' +
                stateLine(s) +
                (s.actionNeeded
                    ? '<p role="alert">Your renewal needs attention.</p>'
                    : '') +
                '</li>',
        )
        .join('')
    const offers = found.result.offers
        .map(
            (o) =>
                '<li><p><strong>' +
                esc(o.name) +
                '</strong> ' +
                money(o.price) +
                ' every ' +
                esc(o.termText) +
                (o.autoRenew ? ', renews until you cancel' : ', prepaid') +
                '</p>' +
                form(
                    context,
                    'purchase',
                    h().hidden('offerId', o.offerId),
                    'Subscribe',
                ) +
                '</li>',
        )
        .join('')
    return h().page(
        context,
        'Your subscriptions',
        '<h1>Your subscriptions</h1>' +
            h().takeNotice(context.site.siteId) +
            '<section id="SubscriptionList">' +
            (items
                ? '<ul class="shop-subscriptions">' + items + '</ul>'
                : '<p>You have no subscriptions yet.</p>') +
            '</section>' +
            (offers
                ? '<section id="Offers"><h2>Subscribe</h2><ul>' +
                  offers +
                  '</ul></section>'
                : ''),
    )
}

/* ---- SubscriptionDetail ---- */
function detailPage(context, contractId) {
    const path = '/Subscriptions/' + cleanId(contractId)
    const found = h().attempt(context, 'getSubscription', {
        contractId: cleanId(contractId),
    })
    if (found.error) return refusal(context, 'Your subscription', found, path)
    const s = found.result.subscription
    const id = h().hidden('contractId', s.contractId)
    const revision = h().hidden('expectedRevision', s.revision)
    const history = s.history
        .map(
            (row) =>
                '<tr><td>' +
                esc(row.periodText) +
                '</td><td>' +
                (row.orderId
                    ? '<a href="' +
                      esc(base(context) + '/Orders/' + row.orderId) +
                      '">' +
                      esc(row.orderId) +
                      '</a>'
                    : '') +
                '</td><td>' +
                money(row.amount) +
                '</td><td>' +
                esc(row.stateText) +
                (row.nextRetryText
                    ? ', next try ' + esc(row.nextRetryText)
                    : '') +
                '</td></tr>',
        )
        .join('')
    const methods = s.methods
        .map(
            (m) =>
                '<option value="' +
                esc(m.paymentMethodId) +
                '"' +
                (s.method?.paymentMethodId === m.paymentMethodId
                    ? ' selected'
                    : '') +
                '>' +
                esc((m.brand || 'Card') + ' ending ' + m.last4) +
                '</option>',
        )
        .join('')
    const resolve = s.actionNeeded
        ? '<section id="ResolveRenewal"><h2>Your renewal</h2><p role="alert">The renewal payment did not go through.</p>' +
          form(context, 'resume', id, 'Try the payment again') +
          '</section>'
        : ''
    const change =
        s.autoRenew && s.canCancel
            ? '<section id="ChangeMethod"><h2>Card for renewals</h2><p>' +
              esc(s.consentText) +
              '</p>' +
              (methods
                  ? form(
                        context,
                        'method',
                        id +
                            revision +
                            '<label>Card <select name="paymentMethodId">' +
                            methods +
                            '</select></label><label><input type="checkbox" name="consent" value="true" required> I agree to renewal charges of ' +
                            money(s.price) +
                            ' to this card every ' +
                            esc(s.termText) +
                            ' until I cancel</label>',
                        'Use this card',
                    )
                  : '') +
              '<p><a href="' +
              esc(base(context) + '/PaymentMethods') +
              '">Add a card</a></p></section>'
            : ''
    const cancel = s.canCancel
        ? '<section id="CancelRenewal"><h2>Cancel renewal</h2><p>Access lasts until ' +
          esc(s.paidThroughText) +
          '; no further charges are made.</p>' +
          form(
              context,
              'cancel',
              id +
                  revision +
                  '<label>Reason (optional) <input name="reason" maxlength="255"></label><label><input type="checkbox" name="confirmCancel" value="true" required> Stop renewing ' +
                  esc(s.name) +
                  '</label>',
              'Cancel renewal',
          ) +
          '</section>'
        : ''
    const renew = s.renewOffer
        ? '<section id="RenewPrepaid"><h2>Buy another term</h2><p>' +
          money(s.renewOffer.price) +
          ' for ' +
          esc(s.renewOffer.termText) +
          ', starting when the current term ends.</p>' +
          form(context, 'purchase', id, 'Buy another term') +
          '</section>'
        : ''
    return h().page(
        context,
        s.name,
        '<p><a href="' +
            esc(base(context) + '/Subscriptions') +
            '">Your subscriptions</a></p><h1>' +
            esc(s.name) +
            '</h1>' +
            h().takeNotice(context.site.siteId) +
            '<section id="Subscription"><p>' +
            money(s.price) +
            ' every ' +
            esc(s.termText) +
            (s.termsVersion ? ' · Terms version ' + esc(s.termsVersion) : '') +
            '</p>' +
            stateLine(s) +
            (s.method
                ? '<p>Renews with ' +
                  esc(
                      (s.method.brand || 'Card') + ' ending ' + s.method.last4,
                  ) +
                  '</p>'
                : '') +
            '</section>' +
            resolve +
            '<section id="RenewalHistory"><h2>History</h2><table><thead><tr><th>Period</th><th>Order</th><th>Amount</th><th>State</th></tr></thead><tbody>' +
            history +
            '</tbody></table></section>' +
            change +
            renew +
            cancel,
    )
}

/* ---- the forms ---- */
const param = (name) => h().param(name)
const operation = () =>
    param('operationId') ? { operationId: cleanId(param('operationId')) } : {}
const detailPath = () => '/Subscriptions/' + cleanId(param('contractId'))
function purchase(context) {
    const found = h().attempt(context, 'beginSubscriptionPurchase', {
        ...operation(),
        ...(param('offerId') ? { offerId: cleanId(param('offerId')) } : {}),
        ...(param('contractId')
            ? { contractId: cleanId(param('contractId')) }
            : {}),
    })
    if (found.error)
        return h().back(
            context,
            param('contractId') ? detailPath() : '/Subscriptions',
            found,
            '',
        )
    ec.web?.response?.sendRedirect(base(context) + '/Checkout')
}
function changeMethod(context) {
    const found = h().attempt(context, 'changeSubscriptionMethod', {
        ...operation(),
        contractId: cleanId(param('contractId')),
        paymentMethodId: cleanId(param('paymentMethodId')),
        consent: param('consent') === 'true' ? 'true' : 'false',
        expectedRevision: param('expectedRevision'),
    })
    h().back(context, detailPath(), found, 'Renewals now use this card.')
}
function cancel(context) {
    if (param('confirmCancel') !== 'true')
        return h().back(
            context,
            detailPath(),
            { error: { message: 'Confirm that you want to stop renewing' } },
            '',
        )
    const found = h().attempt(context, 'cancelSubscription', {
        ...operation(),
        contractId: cleanId(param('contractId')),
        reason: String(param('reason') || '').slice(0, 255),
        expectedRevision: param('expectedRevision'),
    })
    h().back(
        context,
        detailPath(),
        found,
        'Renewal cancelled. Your access lasts to the end of the paid term.',
    )
}
function resume(context) {
    const found = h().attempt(context, 'resumeRenewal', {
        ...operation(),
        contractId: cleanId(param('contractId')),
    })
    h().back(context, detailPath(), found, 'The renewal was tried again.')
}

const actions = { purchase, changeMethod, cancel, resume }
const pages = {
    list: listPage,
    detail: (context) => detailPage(context, ec.context.get('contractId')),
}
;({
    act(context, name) {
        if (!actions[name])
            throw new Error('Unknown subscription action ' + name)
        return actions[name](context)
    },
    render(context, name) {
        if (!pages[name]) throw new Error('Unknown subscription page ' + name)
        return pages[name](context)
    },
})
