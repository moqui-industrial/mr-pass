/* Shop's order, account and download pages (impl-shop P6; design-shop §9 AccountOverview, Addresses, PaymentMethods, Orders,
 * OrderDetail, §10 Downloads). The authority keeps every record (Mantle's ShopCustomerServices and ShopFulfillmentServices);
 * this frontend keeps, in its own server session and never in a page or URL it makes, a guest's order links (the SalesOrder
 * capabilities Shop/ShopCheckout.js keeps from the confirmation, and the emailed link's, taken from Orders/Status and the
 * address then cleaned). Every page is no-store (Shared/Headers.js's default) and renders through the active release's
 * checkout page kind, or in the PASS shell (ShopCheckout.js themed).
 *
 * - AccountOverview (/Account), Orders, Addresses, PaymentMethods and Downloads are a signed-in verified buyer's; an order's
 *   page (/Orders/{orderId}) is the buyer's or a guest's by the order link kept here, which reaches its one order.
 * - OrderDetail links the site's own Support pages with the order (Request a return, Ask a question, Request cancellation),
 *   which take the same order link from this session for a guest (Support/Support.js orderLink).
 * - A download is a GET of Downloads/file?grant=: a capability of ten minutes is issued for that grant and the file streamed
 *   at once with the browser's range (pass.Facade downloadRanged), so a resumed download is checked again.
 * CC0 plus patent grant. */
const portal = () =>
    ec.resource.script('component://mr-pass/screen/Shared/Portal.js')
const checkout = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopCheckout.js')
const carts = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopCart.js')
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
const base = (context) => context.mount.base || ''
const param = (name) => {
    const value = ec.web?.parameters?.[name]
    if (value == null) return null
    if (typeof value === 'object' && value.length != null)
        return value.length ? String(value[0]) : null
    return String(value)
}
const cleanId = (value) =>
    String(value || '')
        .replace(/[^A-Za-z0-9_-]/g, '')
        .slice(0, 40)
const hidden = (name, value) =>
    '<input type="hidden" name="' + name + '" value="' + esc(value ?? '') + '">'
const formToken = () =>
    ec.web ? hidden('moquiSessionToken', ec.web.sessionToken) : ''
const money = (value) => (value ? esc(value.display) : '')
const noticeKey = (siteId) => 'passShopAccountNotice:' + siteId
function notify(siteId, notice) {
    const attributes = ec.web?.sessionAttributes
    if (attributes) attributes[noticeKey(siteId)] = JSON.stringify(notice)
}
function takeNotice(siteId) {
    const attributes = ec.web?.sessionAttributes
    const text = attributes ? attributes[noticeKey(siteId)] : null
    if (!text) return ''
    attributes.remove(noticeKey(siteId))
    try {
        const notice = JSON.parse(String(text))
        const error = notice.kind === 'error'
        return (
            '<p class="shop-notice shop-notice-' +
            (error ? 'error' : 'ok') +
            '" role="' +
            (error ? 'alert' : 'status') +
            '">' +
            esc(notice.text) +
            '</p>'
        )
    } catch (error) {
        return ''
    }
}
const attempt = (context, operation, input) =>
    portal().attempt(
        operation,
        { siteId: context.site.siteId, ...(input || {}) },
        { newTransaction: true },
    )
const page = (context, title, html) =>
    checkout().themed(
        context,
        '<div class="shop-account">' + html + '</div>',
        title,
    )
const accountBase = () => ec.context.get('passBases')?.account ?? '/account'
const signIn = (context, path) =>
    '<p><a href="' +
    esc(
        accountBase() +
            '/Login?returnTo=' +
            encodeURIComponent(base(context) + path),
    ) +
    '">Sign in</a> to see your purchases.</p>'
const refusal = (context, title, found, path) =>
    page(
        context,
        title,
        '<h1>' +
            esc(title) +
            '</h1><p role="alert">' +
            esc(found.error.message) +
            '</p>' +
            (found.error.kind === 'AuthenticationRequired'
                ? signIn(context, path)
                : ''),
    )
const back = (context, path, found, okText) => {
    notify(
        context.site.siteId,
        found.error
            ? {
                  kind: 'error',
                  text:
                      found.error.fieldErrors?.[0]?.message ||
                      found.error.message,
              }
            : { kind: 'ok', text: okText },
    )
    ec.web?.response?.sendRedirect(base(context) + path)
}
const accountLinks = (context, links) =>
    '<nav class="shop-account-links" aria-label="Your account"><a href="' +
    esc(base(context) + '/Orders') +
    '">Orders</a> · <a href="' +
    esc(base(context) + '/Downloads') +
    '">Downloads</a> · <a href="' +
    esc(base(context) + '/Addresses') +
    '">Addresses</a> · <a href="' +
    esc(base(context) + '/PaymentMethods') +
    '">Payment methods</a>' +
    (links?.hub ? ' · <a href="' + esc(links.hub) + '">My account</a>' : '') +
    '</nav>'

/* ---- AccountOverview ---- */
function accountPage(context) {
    const found = attempt(context, 'getShopAccount', {})
    if (found.error) return refusal(context, 'Your account', found, '/Account')
    const a = found.result.account
    if (!a.verified)
        return page(
            context,
            'Your account',
            '<h1>Your account</h1><p role="status">Verify your email address to see your purchases in ' +
                esc(a.storeName) +
                '.</p>' +
                accountLinks(context, found.result.links),
        )
    const orders = a.recentOrders
        .map(
            (o) =>
                '<li><a href="' +
                esc(
                    base(context) + '/Orders/' + encodeURIComponent(o.orderId),
                ) +
                '">Order ' +
                esc(o.orderId) +
                '</a> · ' +
                esc(o.placedText) +
                ' · ' +
                esc(o.statusText) +
                ' · ' +
                money(o.total) +
                '</li>',
        )
        .join('')
    const invoices = a.invoices
        .map(
            (i) =>
                '<li>Invoice ' +
                esc(i.invoiceId) +
                ' · ' +
                money(i.total) +
                ' · ' +
                esc(i.statusText) +
                (i.billingUrl
                    ? ' · <a href="' + esc(i.billingUrl) + '">In Billing</a>'
                    : '') +
                '</li>',
        )
        .join('')
    return page(
        context,
        'Your account',
        '<h1>Your account</h1>' +
            takeNotice(context.site.siteId) +
            '<section class="shop-account-summary" id="PurchaseSummary" aria-labelledby="PurchaseSummaryTitle"><h2 id="PurchaseSummaryTitle">Your purchases</h2>' +
            '<p>' +
            esc(a.orderCount) +
            ' orders' +
            (a.pending ? ', ' + esc(a.pending) + ' in progress' : '') +
            (a.downloadCount
                ? ' · ' + esc(a.downloadCount) + ' downloads'
                : '') +
            '</p>' +
            (orders
                ? '<ul>' + orders + '</ul>'
                : '<p>No orders yet. <a href="' +
                  esc(base(context) + '/') +
                  '">Start shopping</a></p>') +
            (invoices ? '<h3>Invoices</h3><ul>' + invoices + '</ul>' : '') +
            '</section>' +
            accountLinks(context, found.result.links),
    )
}

/* ---- Orders ---- */
function ordersPage(context) {
    const found = attempt(context, 'findShopOrders', {
        cursor: cleanId(param('cursor')) || null,
    })
    if (found.error) return refusal(context, 'Your orders', found, '/Orders')
    const rows = found.result.orders
        .map(
            (o) =>
                '<li><a href="' +
                esc(
                    base(context) + '/Orders/' + encodeURIComponent(o.orderId),
                ) +
                '">Order ' +
                esc(o.orderId) +
                '</a> · ' +
                esc(o.placedText) +
                ' · ' +
                esc(o.statusText) +
                ' · ' +
                money(o.total) +
                '</li>',
        )
        .join('')
    return page(
        context,
        'Your orders',
        '<h1>Your orders</h1><section id="Orders">' +
            (rows
                ? '<ul class="shop-orders">' + rows + '</ul>'
                : '<p>No orders yet.</p>') +
            (found.result.cursor
                ? '<p><a href="' +
                  esc(
                      base(context) +
                          '/Orders?cursor=' +
                          encodeURIComponent(found.result.cursor),
                  ) +
                  '">More orders</a></p>'
                : '') +
            '</section>',
    )
}
/* Orders/Status?token=: an emailed order link: kept in this session for its order, and the page opened without it. */
function statusPage(context) {
    const token = String(param('token') || '')
        .replace(/[^A-Za-z0-9_-]/g, '')
        .slice(0, 128)
    const found = token
        ? attempt(context, 'getShopOrder', { orderToken: token })
        : {
              error: {
                  kind: 'NotFound',
                  message: portal().reasons.notAvailable,
              },
          }
    if (found.error) return refusal(context, 'Your order', found, '/Orders')
    checkout().keepOrderLink(
        context.site.siteId,
        found.result.order.orderId,
        token,
    )
    return {
        redirect:
            base(context) +
            '/Orders/' +
            encodeURIComponent(found.result.order.orderId),
    }
}
/* The order a page names: the session's order link for it (a guest), else the signed-in buyer's own. */
const orderInput = (context, orderId) => {
    const orderToken = ec.user.userId
        ? null
        : checkout().orderLinkOf(context.site.siteId, orderId)
    return { orderId, ...(orderToken ? { orderToken } : {}) }
}
function orderHtml(context, view) {
    const o = view.order
    const a = o.actions
    const lines = o.lines
        .map(
            (l) =>
                '<li>' +
                esc(l.name) +
                ' × ' +
                esc(l.quantity) +
                ' <span>' +
                money(l.total) +
                '</span>' +
                (l.discount
                    ? ' <small>(' + money(l.discount) + ')</small>'
                    : '') +
                '</li>',
        )
        .join('')
    const t = o.totals
    const shipments = o.shipments
        .map(
            (s) =>
                '<li>' +
                esc(s.statusText) +
                (s.shippedText ? ' · ' + esc(s.shippedText) : '') +
                (s.carrierText ? ' · ' + esc(s.carrierText) : '') +
                (s.tracking.length
                    ? ' · Tracking ' + s.tracking.map(esc).join(', ')
                    : '') +
                '</li>',
        )
        .join('')
    const documents = o.documents
        .map(
            (d) =>
                '<li><a href="' +
                esc(
                    base(context) +
                        '/Orders/Document?orderId=' +
                        encodeURIComponent(o.orderId) +
                        '&invoiceId=' +
                        encodeURIComponent(d.invoiceId),
                ) +
                '">Invoice ' +
                esc(d.invoiceId) +
                '</a> · ' +
                esc(d.dateText) +
                ' · ' +
                money(d.total) +
                ' · ' +
                esc(d.statusText) +
                (d.billingUrl
                    ? ' · <a href="' + esc(d.billingUrl) + '">In Billing</a>'
                    : '') +
                '</li>',
        )
        .join('')
    const actions = [
        a.downloadsUrl
            ? '<a href="' +
              esc(
                  a.downloadsUrl +
                      (view.via === 'self'
                          ? ''
                          : '?orderId=' + encodeURIComponent(o.orderId)),
              ) +
              '">Download your files</a>'
            : '',
        a.requestReturnUrl
            ? '<a href="' + esc(a.requestReturnUrl) + '">Request a return</a>'
            : '',
        a.askQuestionUrl
            ? '<a href="' + esc(a.askQuestionUrl) + '">Ask a question</a>'
            : '',
        a.requestCancelUrl
            ? '<a href="' +
              esc(a.requestCancelUrl) +
              '">Request cancellation</a>'
            : '',
        a.cancellationRequested
            ? '<strong>Cancellation requested</strong>'
            : '',
    ].filter(Boolean)
    return (
        '<h1>Order ' +
        esc(o.orderId) +
        '</h1>' +
        takeNotice(context.site.siteId) +
        '<p role="status">' +
        esc(o.statusText) +
        (o.placedText ? ' · ' + esc(o.placedText) : '') +
        '</p><section id="OrderSummary" aria-labelledby="OrderSummaryTitle"><h2 id="OrderSummaryTitle">Summary</h2><ul class="shop-checkout-lines">' +
        lines +
        '</ul><dl class="shop-checkout-totals"><dt>Items</dt><dd>' +
        money(t.items) +
        '</dd>' +
        (t.shipping
            ? '<dt>Delivery</dt><dd>' + money(t.shipping) + '</dd>'
            : '') +
        '<dt>Tax</dt><dd>' +
        money(t.tax) +
        '</dd><dt>Total</dt><dd>' +
        money(t.total) +
        '</dd>' +
        (o.delivery
            ? '<dt>Delivery to</dt><dd>' +
              esc(o.delivery.address) +
              ' (' +
              esc(o.delivery.method) +
              ')</dd>'
            : '') +
        '</dl></section>' +
        (shipments
            ? '<section id="Shipments"><h2>Delivery</h2><ul>' +
              shipments +
              '</ul></section>'
            : '') +
        (documents
            ? '<section id="PurchaseDocuments"><h2>Documents</h2><ul>' +
              documents +
              '</ul></section>'
            : '') +
        (actions.length
            ? '<nav id="OrderActions" aria-label="Help with this order"><p>' +
              actions.join(' · ') +
              '</p></nav>'
            : '') +
        (o.actions.canReorder
            ? '<form method="post" id="Reorder" action="' +
              esc(base(context) + '/Orders/reorder') +
              '">' +
              formToken() +
              hidden('orderId', o.orderId) +
              hidden('operationId', portal().operationId()) +
              '<button type="submit">Buy these again</button> <small>at today\'s prices</small></form>'
            : '')
    )
}
function orderPage(context, orderId) {
    const id = cleanId(orderId)
    const found = attempt(context, 'getShopOrder', orderInput(context, id))
    if (found.error)
        return refusal(
            context,
            'Your order',
            found,
            '/Orders/' + encodeURIComponent(id),
        )
    return page(context, 'Order ' + id, orderHtml(context, found.result))
}
function documentPage(context) {
    const orderId = cleanId(param('orderId'))
    const found = attempt(context, 'getShopOrderDocument', {
        ...orderInput(context, orderId),
        invoiceId: cleanId(param('invoiceId')),
    })
    if (found.error)
        return refusal(
            context,
            'Invoice',
            found,
            '/Orders/' + encodeURIComponent(orderId),
        )
    const d = found.result.document
    return page(
        context,
        'Invoice ' + d.invoiceId,
        '<h1>Invoice ' +
            esc(d.invoiceId) +
            '</h1><p>' +
            esc(d.storeName) +
            ' · Order ' +
            esc(d.orderId) +
            ' · ' +
            esc(d.dateText) +
            ' · ' +
            esc(d.statusText) +
            '</p><ul>' +
            d.lines
                .map(
                    (l) =>
                        '<li>' +
                        esc(l.description) +
                        ' × ' +
                        esc(l.quantity) +
                        ' <span>' +
                        money(l.total) +
                        '</span></li>',
                )
                .join('') +
            '</ul><p><strong>Total ' +
            money(d.total) +
            '</strong></p>' +
            (d.billingUrl
                ? '<p><a href="' +
                  esc(d.billingUrl) +
                  '">Open in Billing</a></p>'
                : ''),
    )
}
/* Orders/reorder: the order's still-offered lines into the session's cart (repriced), then the cart. */
function reorder(context) {
    const found = carts().call(context, 'reorder', {
        orderId: cleanId(param('orderId')),
        ...(param('operationId') ? { operationId: param('operationId') } : {}),
    })
    if (found.error)
        return back(
            context,
            '/Orders/' + encodeURIComponent(cleanId(param('orderId'))),
            found,
            '',
        )
    const missing = found.result.unavailableItems || []
    carts().notify(context.site.siteId, {
        kind: 'ok',
        text:
            "Added to your cart at today's prices." +
            (missing.length
                ? ' Not available now: ' + missing.join(', ') + '.'
                : ''),
    })
    ec.web?.response?.sendRedirect(base(context) + '/Cart')
}

/* ---- Downloads ---- */
function downloadsPage(context) {
    const orderId = cleanId(param('orderId'))
    const orderToken =
        !ec.user.userId && orderId
            ? checkout().orderLinkOf(context.site.siteId, orderId)
            : null
    const found = attempt(
        context,
        'getDownloads',
        orderToken ? { orderToken } : {},
    )
    if (found.error)
        return refusal(context, 'Your downloads', found, '/Downloads')
    const rows = found.result.downloads
        .map(
            (d) =>
                '<li><strong>' +
                esc(d.productName) +
                '</strong> · ' +
                esc(d.fileName) +
                (d.versionText ? ' · ' + esc(d.versionText) : '') +
                (d.sizeText ? ' · ' + esc(d.sizeText) : '') +
                ' · Order ' +
                esc(d.orderId) +
                ' · ' +
                (d.available
                    ? '<a href="' +
                      esc(
                          base(context) +
                              '/Downloads/file?grant=' +
                              encodeURIComponent(d.downloadGrantId) +
                              (orderToken
                                  ? '&orderId=' + encodeURIComponent(orderId)
                                  : ''),
                      ) +
                      '" download>Download</a>'
                    : esc(d.stateText)) +
                '</li>',
        )
        .join('')
    return page(
        context,
        'Your downloads',
        '<h1>Your downloads</h1>' +
            takeNotice(context.site.siteId) +
            '<section id="DownloadList">' +
            (rows
                ? '<ul class="shop-downloads">' + rows + '</ul>'
                : '<p>Nothing to download yet.</p>') +
            '</section>',
    )
}
/* Downloads/file?grant=: a capability of ten minutes for the grant, then the file streamed with the browser's range. */
function downloadFile(context) {
    const orderId = cleanId(param('orderId'))
    const orderToken =
        !ec.user.userId && orderId
            ? checkout().orderLinkOf(context.site.siteId, orderId)
            : null
    const grant = cleanId(param('grant'))
    const issued = attempt(context, 'issueDownload', {
        downloadGrantId: grant,
        ...(orderToken ? { orderToken } : {}),
    })
    if (issued.error)
        return back(
            context,
            '/Downloads' +
                (orderId ? '?orderId=' + encodeURIComponent(orderId) : ''),
            issued,
            '',
        )
    try {
        ec.resource
            .script('component://mr-pass/service/pass/Facade.js')
            .downloadRanged(context.site.siteId, 'getShopDownload', {
                downloadGrantId: grant,
                downloadToken: issued.result.downloadToken,
            })
    } catch (error) {
        ec.message.clearErrors()
        back(
            context,
            '/Downloads',
            { error: { message: 'This file is not available.' } },
            '',
        )
    }
}

/* ---- Addresses ---- */
const ADDRESS_FIELDS = [
    'toName',
    'address1',
    'address2',
    'city',
    'stateProvinceGeoId',
    'postalCode',
    'countryGeoId',
]
const field = (label, name, value, extra) =>
    '<label>' +
    esc(label) +
    ' <input name="' +
    name +
    '" value="' +
    esc(value ?? '') +
    '"' +
    (extra || '') +
    '></label>'
const addressForm = (context, address) =>
    '<form method="post" action="' +
    esc(base(context) + '/Addresses/store') +
    '">' +
    formToken() +
    (address
        ? hidden('contactMechId', address.contactMechId) +
          hidden('expectedRevision', address.revision)
        : '') +
    field('Name', 'toName', address?.toName, ' autocomplete="name"') +
    field(
        'Street address',
        'address1',
        address?.address1,
        ' autocomplete="address-line1" required',
    ) +
    field(
        'Apartment, suite',
        'address2',
        address?.address2,
        ' autocomplete="address-line2"',
    ) +
    field(
        'City',
        'city',
        address?.city,
        ' autocomplete="address-level2" required',
    ) +
    field(
        'State or province',
        'stateProvinceGeoId',
        address?.stateProvinceGeoId,
        ' autocomplete="address-level1"',
    ) +
    field(
        'Postal code',
        'postalCode',
        address?.postalCode,
        ' autocomplete="postal-code" required',
    ) +
    field(
        'Country',
        'countryGeoId',
        address?.countryGeoId || 'USA',
        ' autocomplete="country"',
    ) +
    '<button type="submit">' +
    (address ? 'Save address' : 'Add address') +
    '</button></form>'
function addressesPage(context) {
    const found = attempt(context, 'getAddresses', {})
    if (found.error)
        return refusal(context, 'Your addresses', found, '/Addresses')
    const list = found.result.addresses
        .map(
            (a) =>
                '<li><p>' +
                esc(a.text) +
                (a.purposes.length
                    ? ' <small>' +
                      a.purposes.map((p) => esc(p.text)).join(', ') +
                      '</small>'
                    : '') +
                '</p><details><summary>Change</summary>' +
                addressForm(context, a) +
                '</details><form method="post" action="' +
                esc(base(context) + '/Addresses/end') +
                '">' +
                formToken() +
                hidden('contactMechId', a.contactMechId) +
                '<label><input type="checkbox" name="confirmEnd" value="true" required> Stop using this address</label><button type="submit">Remove</button></form></li>',
        )
        .join('')
    return page(
        context,
        'Your addresses',
        '<h1>Your addresses</h1>' +
            takeNotice(context.site.siteId) +
            '<section id="AddressList">' +
            (list
                ? '<ul class="shop-addresses">' + list + '</ul>'
                : '<p>No saved addresses.</p>') +
            '</section><section id="AddressEdit"><h2>Add an address</h2>' +
            addressForm(context, null) +
            '<p><small>A change does not alter an order already placed.</small></p></section>',
    )
}
function storeAddress(context) {
    const input = {}
    for (const name of ADDRESS_FIELDS.concat([
        'contactMechId',
        'expectedRevision',
    ]))
        if (param(name) != null) input[name] = param(name)
    const found = attempt(context, 'storeAddress', input)
    back(
        context,
        '/Addresses',
        found,
        found.result?.suggestion
            ? 'Saved. The carrier suggests: ' + found.result.suggestion
            : 'Saved the address.',
    )
}
function endAddress(context) {
    back(
        context,
        '/Addresses',
        attempt(context, 'endAddress', {
            contactMechId: cleanId(param('contactMechId')),
        }),
        'The address is no longer used.',
    )
}

/* ---- PaymentMethods ---- */
function paymentMethodsPage(context) {
    const found = attempt(context, 'getPaymentMethods', {})
    if (found.error)
        return refusal(context, 'Payment methods', found, '/PaymentMethods')
    const confirmId = cleanId(param('confirm'))
    const list = found.result.methods
        .map(
            (m) =>
                '<li><p>' +
                esc(m.description) +
                (m.brand ? ' · ' + esc(m.brand) : '') +
                (m.expiry ? ' · ' + esc(m.expiry) : '') +
                (m.provider
                    ? ' <small>(' + esc(m.provider) + ')</small>'
                    : '') +
                (m.ending
                    ? ' <strong>Ending once its open payments complete</strong>'
                    : '') +
                '</p>' +
                (m.contracts.length
                    ? '<p><small>Pays: ' +
                      m.contracts.map((c) => esc(c.name)).join(', ') +
                      '</small></p>'
                    : '') +
                (m.ending
                    ? ''
                    : '<form method="post" action="' +
                      esc(base(context) + '/PaymentMethods/end') +
                      '">' +
                      formToken() +
                      hidden('paymentMethodId', m.paymentMethodId) +
                      (confirmId === m.paymentMethodId
                          ? hidden('confirm', 'true') +
                            '<p role="alert">Ending this card stops it paying: ' +
                            m.contracts.map((c) => esc(c.name)).join(', ') +
                            '.</p>'
                          : '') +
                      '<button type="submit">' +
                      (confirmId === m.paymentMethodId
                          ? 'End it anyway'
                          : 'Remove this card') +
                      '</button></form>') +
                '</li>',
        )
        .join('')
    return page(
        context,
        'Payment methods',
        '<h1>Payment methods</h1>' +
            takeNotice(context.site.siteId) +
            '<section id="SavedMethods">' +
            (list
                ? '<ul class="shop-methods">' + list + '</ul>'
                : '<p>No saved cards.</p>') +
            '</section>' +
            (found.result.canAdd
                ? '<section id="AddMethod"><form method="post" action="' +
                  esc(base(context) + '/PaymentMethods/add') +
                  '">' +
                  formToken() +
                  '<button type="submit">Add a card</button> <small>on the payment provider\'s page; this site never sees your card</small></form></section>'
                : ''),
    )
}
const setupKey = (siteId) => 'passShopMethodSetup:' + siteId
/* PaymentMethods/add: the provider's setup page, a redirect or its relay (the setup's form posted at once). */
function addMethod(context) {
    const found = attempt(context, 'beginPaymentMethodSetup', {})
    if (found.error) return back(context, '/PaymentMethods', found, '')
    const attributes = ec.web?.sessionAttributes
    if (attributes)
        attributes[setupKey(context.site.siteId)] = String(
            found.result.setupReference,
        )
    if (found.result.redirectUrl)
        return ec.web?.response?.sendRedirect(found.result.redirectUrl)
    if (attributes && found.result.form)
        attributes[setupKey(context.site.siteId) + ':form'] = JSON.stringify(
            found.result.form,
        )
    ec.web?.response?.sendRedirect(base(context) + '/PaymentMethods/relay')
}
/* PaymentMethods/relay: the setup page's form, posted at once (its CSP alone allows the provider; Shared/Headers.js). */
function relayPage(context) {
    const attributes = ec.web?.sessionAttributes
    const key = setupKey(context.site.siteId) + ':form'
    let form = null
    try {
        form = JSON.parse(String(attributes?.[key] || 'null'))
    } catch (error) {
        form = null
    }
    if (attributes && attributes[key]) attributes.remove(key)
    if (
        !form?.formUrl ||
        !/^https:\/\/(accept|test)\.authorize\.net\//.test(form.formUrl)
    )
        return { redirect: base(context) + '/PaymentMethods' }
    // the relay posts its form at once with the pages' same-origin script
    return page(
        context,
        'Add a card',
        '<form method="post" id="ShopPaymentRelay" action="' +
            esc(form.formUrl) +
            '">' +
            Object.entries(form.fields || {})
                .map(([name, value]) => hidden(esc(name), value))
                .join('') +
            '<p>Taking you to the payment provider\'s page.</p><button type="submit">Continue</button></form><script src="' +
            esc(base(context) + '/Checkout/enhance') +
            '"></script>',
    )
}
/* PaymentMethods/return: the provider sent the payer back; the authority asks the provider for the account's cards. */
function methodReturned(context) {
    const attributes = ec.web?.sessionAttributes
    const reference = String(
        param('setup') || attributes?.[setupKey(context.site.siteId)] || '',
    )
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 40)
    if (attributes) attributes.remove(setupKey(context.site.siteId))
    const found = attempt(context, 'finishPaymentMethodSetup', {
        setupReference: reference || null,
    })
    back(
        context,
        '/PaymentMethods',
        found,
        found.result?.added ? 'Your card is saved.' : 'No new card was saved.',
    )
}
function endMethod(context) {
    const paymentMethodId = cleanId(param('paymentMethodId'))
    const found = attempt(context, 'endPaymentMethod', {
        paymentMethodId,
        confirm: param('confirm') === 'true' ? 'true' : 'false',
    })
    if (found.result?.needsConfirmation)
        return ec.web?.response?.sendRedirect(
            base(context) +
                '/PaymentMethods?confirm=' +
                encodeURIComponent(paymentMethodId),
        )
    back(context, '/PaymentMethods', found, 'The card is removed.')
}

const actions = {
    reorder,
    downloadFile,
    storeAddress,
    endAddress,
    addMethod,
    methodReturned,
    endMethod,
}
const pages = {
    account: accountPage,
    orders: ordersPage,
    status: statusPage,
    order: (context) => orderPage(context, ec.context.get('orderId')),
    document: documentPage,
    downloads: downloadsPage,
    addresses: addressesPage,
    paymentMethods: paymentMethodsPage,
    relay: relayPage,
}
;({
    act(context, name) {
        if (!actions[name]) throw new Error('Unknown account action ' + name)
        return actions[name](context)
    },
    render(context, name) {
        if (!pages[name]) throw new Error('Unknown account page ' + name)
        return pages[name](context)
    },
    orderHtml,
})
