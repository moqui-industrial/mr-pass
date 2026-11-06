// Shop P4's "usable when" without JavaScript (impl-shop P4; design-shop §18.1 "Guest checkout and later account login", its
// cart half), plain requests on ShopFixtures' ZIZI_SHOP: a guest adds two items (two of one, for TEST2's buy one get one) from the product
// pages' forms, applies TEST2 and sees the discount; another tab's change of the same cart, made from an older page, is
// refused with its reason (the page's notice, and staleRevision as JSON); signing in merges the guest cart into the
// shopper's own cart once (a second sign-in adds nothing), and signing out leaves the browser no cart. Against the remote
// frontend of docs/Deployment.md "Reproducing the remote check" every cart call goes over the authority connection with
// the session's capability; against `./moq accept mr-pass`'s served server (a local authority) it checks the same.
const SHOP = 'http://shop.zizi.localhost:' + server.port
const field = (html, name) =>
    (new RegExp('name="' + name + '" value="([^"]*)"').exec(html) || [])[1] ||
    null
const lines = (html) =>
    Array.from(html.matchAll(/data-item="([^"]+)"/g)).map((m) => m[1])
const operationId = () => 'op' + Date.now() + Math.floor(Math.random() * 1e6)
/* A change posted from a cart page's fields (its revision, as the page showed it). */
const change = (browser, action, page, fields, opts) =>
    browser.post(SHOP + '/Cart/' + action, {
        form: {
            expectedRevision: field(page, 'expectedRevision'),
            operationId: operationId(),
            ...fields,
        },
        ...(opts || {}),
    })
function signIn(browser, username) {
    browser.get(SHOP + '/account/Login')
    return browser.post(SHOP + '/account/Login/save', {
        form: {
            formAction: 'startSession',
            username,
            password: 'moqui',
            operationId: operationId(),
        },
    })
}
feature(
    "a guest adds two items, applies TEST2 and sees the discount; another tab's older change is refused with its reason",
    {
        when() {
            const shopper = session()
            // the product page is public; its form posts with no session, which starts one
            const product = shopper.get(
                SHOP + '/products/DEMO_1_1/demo-product-one-one',
            )
            const first = shopper.post(SHOP + '/Cart/add', {
                form: { productId: 'DEMO_1_1', quantity: '2' },
            })
            const second = shopper.post(SHOP + '/Cart/add', {
                form: { productId: 'DEMO_3_1', quantity: '1' },
            })
            const cart = shopper.get(SHOP + '/Cart')
            const coded = change(shopper, 'applyCode', cart.text, {
                promoCode: 'TEST2',
            })
            const withCode = shopper.get(SHOP + '/Cart')
            // two tabs show the same page; the first changes a quantity, the second then removes a line from its older page
            const tabA = withCode.text
            const tabB = withCode.text
            const [one, two] = lines(tabA)
            const updated = change(shopper, 'update', tabA, {
                orderItemSeqId: one,
                quantity: '3',
            })
            const staleJson = change(
                shopper,
                'remove',
                tabB,
                { orderItemSeqId: two },
                { accept: 'json' },
            )
            const stalePlain = change(shopper, 'remove', tabB, {
                orderItemSeqId: two,
            })
            const afterStale = shopper.get(SHOP + '/Cart')
            return {
                product,
                first,
                second,
                cart,
                coded,
                withCode,
                updated,
                staleJson,
                stalePlain,
                afterStale,
            }
        },
        then({
            product,
            first,
            second,
            cart,
            coded,
            withCode,
            updated,
            staleJson,
            stalePlain,
            afterStale,
        }) {
            product.text.includes('action="/Cart/add"')
            !product.text.includes('name="moquiSessionToken"')
            first.status === 302
            first.location.endsWith('/Cart')
            second.status === 302
            cart.status === 200
            cart.header('cache-control') === 'no-store'
            cart.text.includes('Added Demo Product Three-One to your cart.') ||
                cart.text.includes('to your cart. Your cart has 3 items.')
            cart.text.includes('Demo Product One-One')
            cart.text.includes('$16.99 each')
            lines(cart.text).length === 2
            coded.status === 302
            withCode.text.includes('Applied the code to your cart.')
            withCode.text.includes('TEST2: Buy 1 Get 1 Half Off')
            withCode.text.includes('<dt>Discounts</dt>')
            updated.status === 302
            staleJson.status === 409
            staleJson.json().error.reason === 'staleRevision'
            staleJson.json().error.message ===
                'This changed since you opened it. Reload the page and try again.'
            stalePlain.status === 302
            afterStale.text.includes(
                'This changed since you opened it. Reload the page and try again.',
            )
            lines(afterStale.text).length === 2
            afterStale.text.includes('value="3"')
        },
    },
)
feature(
    "signing in merges the browser's proven cart into the shopper's own once; signing out leaves the browser none",
    {
        when() {
            const shopper = session()
            shopper.post(SHOP + '/Cart/add', {
                form: { productId: 'DEMO_1_1', quantity: '1' },
            })
            const guest = shopper.get(SHOP + '/Cart')
            const signedIn = signIn(shopper, 'pass_http_shopper_r')
            const merged = shopper.get(SHOP + '/Cart')
            const settings = shopper.get(SHOP + '/account/Settings')
            const signedOut = shopper.post(SHOP + '/account/Settings/save', {
                form: { formAction: 'endSession', operationId: operationId() },
            })
            const afterSignOut = shopper.get(SHOP + '/Cart')
            signIn(shopper, 'pass_http_shopper_r')
            const again = shopper.get(SHOP + '/Cart')
            return {
                guest,
                signedIn,
                merged,
                settings,
                signedOut,
                afterSignOut,
                again,
            }
        },
        then({ guest, signedIn, merged, signedOut, afterSignOut, again }) {
            lines(guest.text).length === 1
            signedIn.status === 302
            merged.text.includes(
                'We added the items from this browser to your cart.',
            )
            merged.text.includes('Demo Product One-One')
            merged.text.includes('Demo Product One-Two')
            lines(merged.text).length === 2
            signedOut.status === 302
            afterSignOut.text.includes('Your cart is empty.')
            lines(again.text).length === 2
            !again.text.includes('We added the items from this browser')
        },
    },
)
