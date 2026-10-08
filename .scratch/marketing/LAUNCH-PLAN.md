# JenerOS launch campaign: "Second Life"

Made with the marketing:campaign-plan skill. Assumptions (change any): $0 paid budget, Jener posts personally, launch in ~4 weeks.

## 1. Overview
- **Name:** Second Life (give an old PC a second life).
- **Summary:** Launch the JenerOS early preview to self-hosters and families with an old PC, leading with "your stuff lives at home" and "keep old PCs out of e-waste".
- **Primary goal:** 300 GitHub stars and 100 confirmed installs (people posting screenshots or issues) within 30 days of launch day.
- **Secondary:** 500 site visitors on launch day, 150 newsletter/watchers, 20 useful bug reports, 3 creator or press mentions.

## 2. Audience
| Segment | Who | Pain | Where they are |
|---|---|---|---|
| Primary: tinkerers | Home lab / self-hosting hobbyists | Juggling Docker, Portainer, many logins; NAS UIs that feel like 2005 | r/selfhosted, r/homelab, Hacker News, Lemmy, YouTube (Wolfgang, Jeff Geerling, Techno Tim, Hardware Haven) |
| Secondary: curious families | Someone with an old PC and an iCloud/Google Photos bill | Paying monthly for photos, privacy worries, don't know Linux | TikTok/Shorts, Instagram, X, Facebook groups |
| Third: e-waste / right-to-repair crowd | Sustainability-minded techies | Old laptops sitting in drawers | r/sustainability, Repair Café, Mastodon |

Stage: awareness and first install.

## 3. Messages
- **Core:** Turn the old PC in your closet into your own little cloud. Free, private, and set up from your phone.
- **Supporting:**
  1. *Setup takes minutes:* flash, boot, scan a QR code on your phone. (Proof: setup wizard video.)
  2. *Updates can't brick it:* two system copies; a bad update rolls back by itself. (Proof: A/B + rollback demo.)
  3. *Free for everyone, open source:* GPL-3.0, no paid tier, no disk limits, no account, no telemetry. (Proof: repo, privacy policy.)
  4. *Less e-waste:* most 64-bit PCs from 2012+ with 4 GB RAM work. (Proof: run it on a 10-year-old laptop on camera.)
- **Honesty line (always include):** Early preview: dashboard, safe updates, phone setup and storage work today; the apps are coming next.
- Tone by channel: HN = technical and modest; Reddit = builder sharing a project, ask for feedback; social = warm, visual, cute.

## 4. Channels
| Channel | Why | Format | Effort |
|---|---|---|---|
| r/selfhosted + r/homelab | Exact audience, love new OS projects | Text post with screenshots + "what works / what doesn't" | Medium |
| Hacker News "Show HN" | Technical credibility; mkosi/A-B/dm-verity story | Show HN post + founder comment | Medium |
| GitHub | Where installs and stars happen | Polished README (PR #1), release v0.4.0, Discussions on, good-first-issue labels | Medium |
| jener.dev | Home base | Live site with screenshots, download, short video | Low (done, needs deploy) |
| X / Bluesky / Mastodon @jener_inc | Build-in-public | 3x/week progress clips, launch thread | Low-Medium |
| YouTube Shorts / TikTok / Reels | Families, e-waste angle | 30-60s "old laptop to cloud" | Medium-High |
| Creator outreach | One video = thousands of installs | Short personal email + test box image | Medium |
| Product Hunt | Second wave, after first fixes | Launch in week 4 | Medium |

## 5. Before launch (blockers)
1. Publish a real release (v0.4.0 preview): release build (not TEST_SSH), img.xz + update files on GitHub Releases, verified install on one real old PC.
2. Merge zimaos-style into main; merge README PR #1 and add real screenshots.
3. Deploy jener.dev (Cloudflare) and create privacy@jener.dev.
4. Record a 60s video: old laptop, flash USB, boot, scan QR, dashboard, create storage.
5. Enable GitHub Discussions, issue templates, CONTRIBUTING.md, SECURITY.md.
6. Claim handles: @jener_inc on X, Bluesky, Mastodon, YouTube, TikTok, Instagram.

## 6. Calendar
| Week | What | Channel | Notes |
|---|---|---|---|
| -3 | Fix blockers 1-3; start build-in-public posts (setup wizard clip, storage wizard clip) | X/Bluesky/Mastodon | Real footage only |
| -2 | Record hero video + 6 screenshots; README screenshots; site screenshots | GitHub, site | Depends on release build |
| -1 | Soft launch: 10-20 testers (friends, Discord), fix top bugs; draft all launch posts; email 5 creators | DM/email | Don't post publicly yet |
| 0 (Tue) | Launch day: Show HN 8-9am ET; r/selfhosted same day; launch thread; Lemmy/Mastodon | HN, Reddit, social | Answer every comment for 6h |
| 0 (Thu) | r/homelab post (different angle: old hardware) | Reddit | Space posts apart |
| +1 | "What we learned" post + fixes release v0.4.1 | GitHub, social | Credit bug reporters |
| +2 | E-waste angle: Shorts/TikTok "old laptop second life" | Short video | Families audience |
| +3 | Product Hunt launch; newsletter #1 | PH, email | Only after v0.4.1 |
| +4 | Recap: numbers, roadmap vote (Photos vs Files next) | All | Community feeling |

## 7. Assets
| Asset | Priority | Notes |
|---|---|---|
| v0.4.0 release + notes | Must | Honest changelog |
| 60s hero video | Must | Real box, no mockups |
| 6 screenshots (setup, dashboard, settings, store, storage, phone) | Must | Light + dark |
| Show HN post | Must | Draft below |
| r/selfhosted post | Must | Draft below |
| Launch thread (X/Bluesky) | Must | Draft below |
| Creator email | Must | Short, personal |
| Press kit page on jener.dev | Nice | Logo, screenshots, one-liner |
| Comparison page (vs DIY Docker) | Nice | Never name/copy competitors' assets |

## 8. Metrics
- Primary: GitHub stars and installs (issues/screenshots tagged "installed").
- Secondary: release downloads (GitHub API), site visits (Cloudflare Web Analytics, cookie-free), HN points/comments, Reddit upvotes, follower growth.
- Check daily in launch week, weekly after.

## 9. Risks
| Risk | Mitigation |
|---|---|
| Install fails on real hardware and first impressions sour | Test on 3 real old PCs before launch; clear "early preview" label; fast fix release |
| "Another CasaOS/ZimaOS clone" reaction | Lead with what's different: A/B safe updates, phone QR setup, read-only system, free with no limits, e-waste mission |
| Security questions (no HTTPS on LAN, login) | Be upfront in posts; SECURITY.md; roadmap item for local HTTPS |
| Launch spike, then silence | Weekly build-in-public posts and a public roadmap |

## 10. Drafts

### Show HN
Title: `Show HN: JenerOS – turn an old PC into a home cloud you set up from your phone`

Body:
I built JenerOS, a free (GPL-3.0) home server OS for old PCs. You flash it, boot, and finish setup on your phone by scanning a QR code on the box's screen.

Under the hood it's Debian 13 built with mkosi: read-only /usr with A/B slots and dm-verity, updates via systemd-sysupdate, and automatic rollback if a new version doesn't boot. The dashboard is served by a small Go daemon (stdlib only). Storage uses Btrfs mirrors created from a wizard.

It's an early preview: setup, dashboard, safe updates and storage work; Photos/Files/Media apps are next. I'd love feedback on the update design and what you'd want it to run first.

Site: https://jener.dev · Code: https://github.com/PrimeExtremo/JenerOS

### r/selfhosted
Title: `I made a free OS that turns an old PC into a home cloud: phone setup, safe A/B updates, no paid tier`

Body: what it is (2 lines), 4-5 screenshots, what works today, what doesn't yet, hardware needed, how to try it in a VM, "what should I build next: Photos, Files or Media?", links.

### Launch thread (X/Bluesky)
1. That old PC in your closet can be your own cloud. Meet JenerOS, free and open source. [video]
2. Flash it, boot it, scan the QR with your phone. Setup takes minutes. [setup clip]
3. Updates can't brick it: two copies of the system, and a bad update rolls back by itself.
4. Your photos and files stay at home. No account, no tracking, no paid tier.
5. Early preview: try it, break it, tell us. jener.dev
