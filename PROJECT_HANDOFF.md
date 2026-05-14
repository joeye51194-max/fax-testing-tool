# FaxSignal Project Handoff

## Project

FaxSignal fax endpoint testing website.

Live site:

- https://faxsignal.com

GitHub repo:

- https://github.com/joeye51194-max/fax-testing-tool

Railway app:

- Project/service name appears to be `fax-testing-tool`
- Railway public/custom domain is connected to `faxsignal.com`
- Custom domain needed port `8080` in Railway networking.

## Current Status

- Node/Express app is deployed through Railway from GitHub.
- Domain `faxsignal.com` is registered/managed through Cloudflare.
- Cloudflare DNS was connected through Railway's one-click DNS setup.
- The site loads at `https://faxsignal.com`.
- Search Console verification meta tag is added.
- Search Console sitemap was submitted and processed successfully.
- Sitemap discovered 10 pages.
- AdSense verification script is installed on public pages.
- `ads.txt` is live in the repo at `public/ads.txt`.
- Public app branding is generic and does not mention Telnyx.
- The site is branded as `FaxSignal`.
- Homepage has modern tech-style background, default fax preview, FAQ, use cases, guides, and support pages.
- The public UI does not show Fax ID/Test ID.
- The generated fax PDF does not include a visible test ID.
- The app sends one default generated test PDF from `/test-fax.pdf`.
- The app has a rate limit for fax sends.
- Contact page uses `contact@faxsignal.com`.

## Important URLs

- Home: https://faxsignal.com
- Test fax PDF: https://faxsignal.com/test-fax.pdf
- Webhook endpoint: https://faxsignal.com/webhooks/fax-provider
- Sitemap: https://faxsignal.com/sitemap.xml
- Robots: https://faxsignal.com/robots.txt
- Ads.txt: https://faxsignal.com/ads.txt
- Contact: https://faxsignal.com/contact.html

## Environment Variables

Configured in Railway, not committed to GitHub:

- `TELNYX_API_KEY`
- `TELNYX_FAX_CONNECTION_ID=2958080556639716887`
- `TELNYX_FAX_FROM_NUMBER=+17477461109`
- `SITE_URL=https://faxsignal.com`
- `DRY_RUN=false`
- `RATE_LIMIT_PER_DAY=10`
- `ADS_ENABLED=false`
- `ADSENSE_CLIENT_ID=ca-pub-7212750288013173`
- `ADSENSE_SLOT_RECT` blank until ad units are created.

Do not commit `.env`; it is ignored by git.

## Telnyx

Telnyx is used behind the scenes for Programmable Fax.

Public pages should remain provider-generic.

Telnyx webhook URL:

- `https://faxsignal.com/webhooks/fax-provider`

The app sends faxes through:

- `POST https://api.telnyx.com/v2/faxes`

The app gives the provider this media URL:

- `https://faxsignal.com/test-fax.pdf`

## AdSense

Current publisher ID:

- `ca-pub-7212750288013173`

Ads.txt content:

```text
google.com, pub-7212750288013173, DIRECT, f08c47fec0942fa0
```

AdSense status seen in chat:

- `faxsignal.com` was listed as `Getting ready`.
- Ads.txt initially showed `Not found`; `public/ads.txt` was added afterward.

Keep `ADS_ENABLED=false` until Google approves the site. The verification script is present, but visible ad units should stay off until approval.

## Search Console

Search Console verification meta tag added:

```html
<meta name="google-site-verification" content="Vd3u8Q2LMt1oJimx-ZL-PciMQme2R0vy7m7Flj4dyw0">
```

Sitemap URL:

- https://faxsignal.com/sitemap.xml

Search Console processed the sitemap successfully and discovered 10 pages.

## Important Files

- `server.js`: Express server, fax send route, webhook handler, PDF generation, sitemap, robots.
- `public/index.html`: Homepage, FaxSignal UI, SEO/FAQ schema, default fax preview.
- `public/app.js`: Frontend send/refresh behavior.
- `public/styles.css`: Site styling and modern tech background.
- `public/ads.txt`: AdSense ads.txt.
- `public/contact.html`: Contact page with `contact@faxsignal.com`.
- `public/privacy.html`
- `public/terms.html`
- `public/about.html`
- `public/resources.html`
- `public/articles/`: SEO/supporting articles.

## Recent Git Commits

- `6030262` Initial fax testing app
- `6124cde` Add AdSense verification script
- `3aad70b` Add Search Console verification tag
- `ba85594` Polish FaxSignal experience
- `267be8c` Show default fax preview
- `8af61c0` Improve homepage polish and feedback
- `d71ce7a` Improve contact page
- `26fccd7` Add modern tech background
- `bf8d748` Update AdSense publisher ID
- `ef5c2c8` Add AdSense ads.txt

## Notes For Future Chat

- The user wants project state stored in a handoff file so another chat session can understand the work already done.
- Keep FaxSignal separate from the CNAM project.
- Keep public wording provider-neutral; do not mention Telnyx in visible page copy.
- Keep secrets out of git.
- If adding ads, wait for AdSense approval first.
- If adding persistence, replace in-memory `faxTests` with a small database or durable store so webhook updates survive Railway restarts.
- If adding more tools for AdSense sites, good ideas discussed were:
  - ads.txt checker/generator
  - fax cover sheet generator
  - SMS segment calculator
  - email DNS checker
  - website launch checklist

## Security Reminder

The Telnyx API key was pasted into chat during setup. Rotate/create a fresh key before scaling or if there is any concern about exposure.
