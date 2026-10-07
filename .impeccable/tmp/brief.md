# Surface: JenerOS dashboard

Scope: `[DASHBOARD]/` (index.html, style.css, app.js), served by jenerd on the box. Mode: Operate.
Audience/job: the owner checks the box is alive, sees what's on it, updates it, and (later) installs apps, manages disks and VMs. Also opened on phones and TV browsers.
Constraints: everything shown is real data or labelled "coming soon"; big targets; arrow-key/remote navigation; works offline on the LAN (fonts fall back to system faces when Google Fonts is unreachable).
Pinned by Jener (2026-10-07, latest): the Apple-style dashboard (frosted bar, soft rounded cards, colorful rounded app icons) with color, "mostly like Claude's style" and the Zen Browser palette; keep all function (pages, live stats, update center, TV/remote keys); small corner logo watermark. Earlier monochrome/neobrutalist direction is retired for the dashboard; logo, boot splash and SSH stay monochrome.

## Direction contract

THESIS: Your home server greets you like a calm, warm app on your phone: an iOS-style home with real numbers and honest "coming soon" cards. Refuses the dark glassy admin console with neon graphs.

OWN-WORLD: Zen paper #F2F0E3, ivory cards #FAF9F5, ink #2E2E2E (dark: #1F1F1F, #2A2927, #ECE9DD). Claude orange #D97757 for marks, meters and focus; #B9562F for filled buttons (AA). Muted warm app gradients (coral, sky, sun, sage, lavender, clay). Frosted sticky bar, filled ink pill for the active page, 22px soft-shadow cards, squircle app icons with white line doodles. Bricolage Grotesque headings, system UI text.

STORY: The owner sees a friendly greeting, knows the box is up (address, storage, memory, busy, awake time), what lives on it, and whether it is current, and can update in one tap.

FIRST VIEWPORT: Frosted bar: orange J + "JenerOS" left, pill nav centered (Home, Apps, Storage, Machines, System), "Update to X" orange pill and host chip right. Greeting "Good evening" with the orange J, line "Your stuff lives at home, on <host> at <ip>." Five stat cards with orange doodles and meters. "On this box" row of colorful squircle tiles.

FORM: brief-pinned by Jener (no roll). Signature interaction: tiles lift on hover and press in like iOS; stats refresh every 5 s with tabular numbers; arrow keys move focus like a TV remote. Motion 150-250 ms ease-out, transform/opacity only.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
