# Security

JenerOS is an early preview for a trusted home network. Do not expose its
dashboard or app ports directly to the internet.

## Supported versions

| Version | Security fixes |
|---|---|
| Latest published 0.4.x release | Preview fixes; update to the newest release |
| Older releases and development builds | No separate fixes; upgrade or rebuild |

Hardening in the source tree is not a claim that an older image contains it.
Check the release notes for the version installed on your box.

## Report a vulnerability

Use a [private GitHub security advisory](https://github.com/PrimeExtremo/JenerOS/security/advisories/new).
Include the affected version, a short description, steps to reproduce, and the
impact. Remove passwords, session cookies, private keys and personal files.
Please keep exploit details private while a fix is prepared. There is no promised
response deadline or bug bounty during the preview.

Reports about the dashboard, setup, owner login, root workers, image build and
update verification are in scope. If the problem comes from an upstream app or
package, report it to that project's maintainers too; include its exact version.
Test only systems you own or have permission to assess.

See the [threat model]([DOCS]/THREAT-MODEL.md) for boundaries and current limits.
