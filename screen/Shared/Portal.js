/* The Billing and Supplier apps' calls to the authority: one operation through the facade, answered as its result or as a
 * refusal a page can show without saying more than the kind allows. CC0 plus patent grant. */
const call = (operation, input) =>
    ec.service
        .sync()
        .throwOnError(true)
        .name('pass.Facade.call#Operation')
        .parameters({ operation, input })
        .call().result
const messages = {
    NotFound: 'This page is not available. The link may have expired or been replaced.',
    AuthenticationRequired: 'Sign in to continue.',
    Tarpit: 'Too many attempts. Wait a few minutes and try again.',
    Unavailable: 'This is not available right now. Try again later.',
}
/* An operation's result, or {error: {kind, message}}: a NotFound or a sign-in says nothing of the record. */
function attempt(operation, input) {
    try {
        return { result: call(operation, input) }
    } catch (error) {
        ec.message.clearErrors()
        const kind = error.moquiErrorKind || 'Unavailable'
        const text = String(error.message || '').split('\n')[0].replace(/^[A-Z_]+: /, '')
        return {
            error: {
                kind,
                message:
                    messages[kind] ||
                    (['Unprocessable', 'Conflict'].includes(kind) && text ? text : messages.Unavailable),
            },
        }
    }
}
/* A short random id for a request that must not run twice. */
const operationId = () => ec.user.randomString(32)
;({ call, attempt, operationId })
