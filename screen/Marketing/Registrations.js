/* PASS Marketing's Register and Registration pages' helpers (IronStone impl-marketing P17; design-marketing §13 Register,
 * Registration): the reservation's capability kept in the visitor's session (never in a page's address once read from a
 * link), each operation through the facade (Marketing.js, Shared/Portal.js attempt), and the page's view of the answer. The
 * authority decides everything; these only carry the request. CC0 plus patent grant. */
const marketing = ec.resource.script("component://mr-pass/screen/Marketing/Marketing.js")
const keyOf = (siteId, reference) => "passMarketingRegistration:" + siteId + ":" + reference
const ticketKey = "passMarketingTicket"
const session = () => {
    try {
        return ec.web?.sessionAttributes || null
    } catch (error) {
        return null
    }
}
const referencePattern = /^[A-Za-z0-9_-]{1,40}$/
/* The capability the session keeps for a reservation, or null. */
function tokenOf(siteId, reference) {
    const attributes = session()
    if (!attributes || !reference || !referencePattern.test(reference)) return null
    const value = attributes[keyOf(siteId, reference)]
    return value ? String(value) : null
}
function keep(siteId, reference, token) {
    const attributes = session()
    if (attributes && token && reference) attributes[keyOf(siteId, reference)] = String(token)
}
/* How a page reaches a reservation: the session's capability, else the signed-in buyer's own reservation (the authority checks
 * the account), else the provider's return key. */
function reachOf(siteId, reference, returnKey) {
    const token = tokenOf(siteId, reference)
    if (token) return {token}
    if (returnKey) return {reference, key: returnKey}
    if (ec.user.userAccount && reference && referencePattern.test(reference)) return {reservationId: reference}
    return null
}
/* An operation for a reservation: {result} or {error}. */
function call(operation, siteId, reach, input) {
    return marketing.portal.attempt(operation, Object.assign({siteId}, reach || {}, input || {}), {newTransaction: true})
}
/* A refusal kept for the next page, then a redirect. */
function back(path, params, error) {
    const s = session()
    if (s && error) {
        s.passMarketingError = error.message
        const field = error.fieldErrors?.[0]?.field
        if (field) s.passMarketingField = field
    }
    ec.web.response.sendRedirect(path + marketing.query(params))
}
/* A ticket's entry code shown once, on the next page. */
function keepTicket(ticket) {
    const s = session()
    if (s && ticket) s[ticketKey] = JSON.stringify(ticket)
}
function takeTicket() {
    const s = session()
    const text = s ? s[ticketKey] : null
    if (!text) return null
    s.remove(ticketKey)
    try {
        return JSON.parse(String(text))
    } catch (error) {
        return null
    }
}
const paragraphs = text =>
    String(text || "")
        .split(/\n\s*\n/)
        .map(s => s.trim())
        .filter(s => s)
;({marketing, tokenOf, keep, reachOf, call, back, keepTicket, takeTicket, paragraphs, referencePattern})
