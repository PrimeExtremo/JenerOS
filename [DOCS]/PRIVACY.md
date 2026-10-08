# JenerOS Privacy Policy

Draft for the early preview. Have a lawyer check this before JenerOS is sold or marketed in the EU/UK.

Effective: 2026-10-08 · Jener, Inc. · jener.dev

## The short version
Your box is yours. JenerOS keeps your photos, files, passwords and settings on your box. We don't run accounts, collect analytics, or see what you store.

## What stays on your box
- Everything you store: files, photos, media, app data, backups.
- Your owner account. The password is stored as a one-way hash, never in plain text.
- Settings you choose in setup: box name, timezone, keyboard, network.
- System logs. They stay on the box and rotate on their own.

## What your box connects to, and why
| Connects to | When | What it sends |
|---|---|---|
| GitHub Releases (github.com) | Checking for and downloading JenerOS updates | A normal web request: your public IP and the file it asks for. No account, no ID. |
| Public time servers (Debian NTP pool) | Keeping the clock right | A standard time request. |
| App image registries (e.g. Docker Hub) | Only when you install or update an app | A normal download request. |
| The app itself | Whatever that app does | Each app has its own privacy policy. Check it before you install. |

JenerOS sends no telemetry, crash reports or usage stats. If we ever add any, it will be off until you turn it on, and this page will say so first.

## Setup on your phone
The setup QR code and 6-digit code work only on your home network and only until setup is done. Nothing goes through our servers.

## Remote access
Remote access (from outside your home) is off by default. If you turn it on, this page and the setup screen will name the service it uses.

## Kids
JenerOS doesn't collect anything from anyone, including children. Parents decide who gets an account on the box.

## Your choices
- Only install the apps you want. Nothing is installed for you.
- Wipe the box by reinstalling JenerOS.

## Changes
If this policy changes, the new version ships with the update that changes it, and the dashboard tells you.

## Contact
privacy@jener.dev <!-- TODO Jener: create this mailbox before release, or change the address. -->
