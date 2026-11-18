// Run only in the dedicated remote frontend runtime described in README.
feature(
    'remote frontend has no Mantle entity catalog or copied business accounts',
    {
        ignore: !ec.factory.getConfValue('pass@backend-url')
            ? 'Requires the dedicated remote frontend runtime'
            : false,
        when() {
            return {
                configured: !!ec.factory.getConfValue('pass@backend-url'),
                mantle: ec.entity.isEntityDefined('mantle.party.Party'),
                forum: ec.entity.isEntityDefined('mantle.forum.ForumTopic'),
            }
        },
        then({ configured, mantle, forum }) {
            configured === true
            mantle === false
            forum === false
        },
    },
)
