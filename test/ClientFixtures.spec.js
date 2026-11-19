spec({
    setupSpec() {
        login('john.doe')
        ec.artifactExecution.disableAuthz()
    },
    cleanupSpec() {
        ec.artifactExecution.enableAuthz()
    },
})
feature('provision a published HTTP test community', {
    when() {
        const siteId = 'PASS_HTTP',
            partyId = ec.user.userAccount.partyId
        call('create#mantle.public.PublicSite', {
            siteId,
            name: 'PASS HTTP community',
            state: 'published',
            registrationMode: 'closed',
            locale: 'en',
            timeZone: 'UTC',
            policyRevision: 1,
            generation: 1,
        })
        call('create#mantle.public.PublicSiteParty', {
            siteId,
            partyId,
            state: 'active',
            role: 'owner',
            revision: 1,
        })
        const run = (service, input) =>
            call(service, {
                input: service.endsWith('store#Category')
                    ? { operationId: ec.user.randomString(32), ...input }
                    : input,
            }).result
        run('mantle.public.SiteServices.store#Mounts', {
            siteId,
            expectedRevision: 1,
            mounts: [
                { app: 'forum', pathPrefix: '/forum' },
                { app: 'account', pathPrefix: '/account' },
                { app: 'members', pathPrefix: '/members' },
                { app: 'sites', pathPrefix: '/sites' },
            ],
            hosts: [{ hostname: '127.0.0.1', canonical: true }],
        })
        const category = run('mantle.forum.ForumServices.store#Category', {
            siteId,
            name: 'Welcome',
        })
        run('mantle.forum.ForumServices.set#CategoryAccess', {
            siteId,
            contactListId: category.contactListId,
            visibility: 'public',
            publicationState: 'published',
            confirm: true,
            expectedRevision: 1,
        })
        const published = run('mantle.forum.ForumServices.publish#Post', {
            siteId,
            contactListId: category.contactListId,
            title: 'Welcome to the community',
            body: '<p>Public server-rendered discussion.</p>',
            operationId: 'http-fixture-001',
        })
        const state = ec.entity
            .find('mantle.forum.ForumMemberState')
            .condition({ siteId, partyId })
            .one()
        state.set('lastPostedAt', Date.now() - 60000)
        // The browser specs start several topics in one run; an established owner is past the new-member daily cap.
        state.set('trustLevel', 'member')
        state.update()
        // A second member with a public profile, so the browser specs can exchange private messages.
        const reader = call('mantle.party.PartyServices.create#Person', {
            firstName: 'Forum',
            lastName: 'Reader',
        }).partyId
        call('mantle.party.PartyServices.create#PartyUserAccount', {
            partyId: reader,
            username: 'pass.http.reader',
            emailAddress: 'reader@example.test',
            newPassword: 'moqui1!!',
            newPasswordVerify: 'moqui1!!',
        })
        call('create#mantle.public.PublicSiteParty', {
            siteId,
            partyId: reader,
            state: 'active',
            role: 'member',
            revision: 1,
        })
        // Only the recipient needs a handle; the owner's profile is created by the remote profile check.
        call('create#mantle.public.PublicSiteProfile', {
            siteId,
            partyId: reader,
            handle: 'reader',
            displayName: 'reader',
            discoverability: 'members',
            revision: 1,
        })
        return published
    },
    then(result) {
        result.state === 'published'
    },
})
// The security proofs' accounts (test/proofs), set again on every run, so that a database kept between runs takes the
// proofs again. pass.pw.proof is a public account whose password V6Authentication changes: its password and its count of
// failed logins are reset here. pass.reg.proof@example.test is a registration waiting for its address check, as
// begin#Registration leaves one (a disabled account with a password nobody knows), with two codes: one good for an hour
// and one already expired. The codes are known here and in the proof, as the mailbox would hold them (the framework's
// ClientFixtures does the same for its single-use factor); V6Authentication uses each once.
const PROOF_USER = 'pass.pw.proof',
    PROOF_PASSWORD = 'PassPwProof1!!'
const REG_ADDRESS = 'pass.reg.proof@example.test',
    REG_CODE = 'PassRegProofLiveCode'.padEnd(64, '0'),
    REG_EXPIRED_CODE = 'PassRegProofExpiredCode'.padEnd(64, '0')
feature("the security proofs' accounts are made or set again", {
    when() {
        const account = (username) =>
            ec.entity.find('moqui.security.UserAccount').condition({ username }).one()
        if (!account(PROOF_USER)) {
            const partyId = call('mantle.party.PartyServices.create#Person', {
                firstName: 'Password',
                lastName: 'Proof',
            }).partyId
            call('mantle.party.PartyServices.create#PartyUserAccount', {
                partyId,
                username: PROOF_USER,
                emailAddress: 'pw.proof@example.test',
                newPassword: PROOF_PASSWORD,
                newPasswordVerify: PROOF_PASSWORD,
            })
        }
        const pw = account(PROOF_USER)
        pw.setAll({
            currentPassword: ec.user.hashPassword(PROOF_PASSWORD),
            passwordSalt: '',
            passwordHashType: 'argon2',
            passwordBase64: 'N',
            requirePasswordChange: 'N',
            disabled: 'N',
            disabledDateTime: null,
            successiveFailedLogins: 0,
        })
        pw.update()

        // as begin#Registration makes the account: its address as the user name, disabled, a password nobody knows
        const rules = ec.user.passwordRules
        const placeholder =
            ec.user.randomString(48) +
            '7'.repeat(Number(rules.minDigits) || 0) +
            '!'.repeat(Number(rules.minOthers) || 0)
        if (!account(REG_ADDRESS))
            call('org.moqui.impl.UserServices.create#UserAccount', {
                username: REG_ADDRESS,
                emailAddress: REG_ADDRESS,
                newPassword: placeholder,
                newPasswordVerify: placeholder,
                disabled: 'Y',
                deferIdentityLink: true,
            })
        const reg = account(REG_ADDRESS)
        reg.setAll({
            currentPassword: ec.user.hashPassword(placeholder),
            passwordSalt: '',
            passwordHashType: 'argon2',
            passwordBase64: 'N',
            disabled: 'Y',
            disabledDateTime: null,
            successiveFailedLogins: 0,
        })
        reg.update()
        ec.entity.find('moqui.security.public.VerifiedAddress').condition({ userId: reg.userId }).deleteAll()
        const now = ec.user.timestampMillis(ec.user.nowTimestamp)
        const challenge = (challengeId, code, expiresAt) => {
            const fields = {
                userId: reg.userId,
                emailAddress: REG_ADDRESS,
                tokenHash: ec.user.singleUseCodeHash(code),
                expiresAt,
                consumedAt: null,
                newAccount: 'Y',
            }
            const old = ec.entity
                .find('moqui.security.public.RegistrationChallenge')
                .condition({ challengeId })
                .one()
            if (old) {
                old.setAll(fields)
                old.update()
            } else {
                const row = ec.entity.makeValue('moqui.security.public.RegistrationChallenge')
                row.setAll({ challengeId, ...fields })
                row.create()
            }
        }
        challenge('PASS_PROOF_REG_LIVE', REG_CODE, now + 3600000)
        challenge('PASS_PROOF_REG_EXPIRED', REG_EXPIRED_CODE, now - 60000)
        return {
            pw: account(PROOF_USER),
            reg: account(REG_ADDRESS),
            open: ec.entity
                .find('moqui.security.public.RegistrationChallenge')
                .condition('userId', reg.userId)
                .condition('consumedAt', null)
                .count(),
        }
    },
    then({ pw, reg, open }) {
        pw.disabled === 'N'
        ec.user.passwordsMatch(PROOF_PASSWORD, pw.currentPassword, pw.passwordHashType, pw.passwordSalt, false)
        reg.disabled === 'Y'
        open === 2
    },
})
