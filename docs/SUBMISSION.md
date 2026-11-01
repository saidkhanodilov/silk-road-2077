# Hackathon submission: "Your project" write-up

Paste into the hackathon's **Your project** tab. Replace every `TODO` first.
Deadline: **Friday, November 6**. Each section follows a part of the judging rubric.

---

## Title
Silk Road 2077: a portfolio you can fly in a camel spaceship

## Tagline (one line)
My story is hidden on a 3D Silk Road in the year 2077. Press the camel, fly from Chelak to The Cloud, and meet the scientists from each city along with the things I built.

## Links
- **Live site (AWS Amplify Hosting):** TODO https://main.XXXX.amplifyapp.com
- **GitHub:** https://github.com/saidkhanodilov/silk-road-2077

---

## The creative feature (Creativity and memorability, 30%)

Right under the main buttons there's a visible hint: *"Secret route detected: my story is hidden on a 3D Silk Road. Press the camel to fly it."* Press it and a full-screen three.js game opens on top of the portfolio.

You pilot **Chelak-1**, a two-humped Bactrian-class spaceship, down a neon highway. You collect ☕ Java beans and dodge 🐛 NullPointerExceptions, and you stop at five cities on my real route through Uzbekistan. Each stop pairs a scientist from that city with something I built:

| Station | Then | Now (me) |
| --- | --- | --- |
| Chelak | My hometown | My first websites for local education centers, kept running on AWS EC2, and TEDxChelak Youth |
| Samarkand | Ulugh Beg's star catalogue (1420s) | SimulateUz, a C++17 rocket simulator that reaches a 400 km orbit |
| Bukhara | Ibn Sina and the Samanid library | LearnForFree, a free learning platform with 63 REST endpoints |
| Khiva | Al-Khwarizmi, the man behind the word "algorithm" | 297 Codeforces solutions in Java |
| Tashkent | Where I live now | CS at Central Asian University and leading the campus AWS Student Builder Group |
| The Cloud | Final destination | This site, running on AWS |

Details I added because they're me:
- **An IAM policy power-up.** An orange AccessDenied shield blocks the next bug. Least privilege, finally useful.
- **Every city has its own sky:** turquoise tiles in Samarkand, lapis in Bukhara, desert neon in Khiva.
- **A rank and a boarding pass at the end.** You get a rank from "Intern (unpaid, but happy)" to "Senior Bean Engineer", plus a shareable boarding pass with a snapshot of your camel.
- **The hero globe shows the real day and night right now**, worked out from the sun's position, with city lights placed from 7,000+ real populations. There are also 14 achievements, a Konami-code meme mode, and a lost-caravan 404 page.

**It never gets in the way of navigation.** The game is optional, and every fact in it is also in the normal HTML page. Esc closes it and returns you to where you were. A "Read it as text" mode works for screen readers and for devices without WebGL. It runs on keyboard, touch buttons, and swipes.

---

## How I used AWS (Working AWS implementation, 25%)

```
git push → GitHub → AWS Amplify Hosting (build from amplify.yml) → Amazon CloudFront edge → visitors, over HTTPS
```

| AWS service | What it does |
| --- | --- |
| **AWS Amplify Hosting** | Connected to the GitHub repo. Every push to `main` builds and deploys automatically, and keeps a history of every deploy. |
| **Amazon CloudFront** (managed by Amplify) | Serves the site from edge locations worldwide. |
| **Managed HTTPS certificate** | HTTPS on the `amplifyapp.com` domain with no setup. |
| **Amplify custom headers** (`customHttp.yml`) | A strict Content-Security-Policy, HSTS, X-Frame-Options DENY, nosniff, and a year of caching for fonts. |
| **Amplify rewrite rule** | Unknown paths get `404.html` with a real 404 status. |

Screenshots to attach (TODO):
1. Amplify console: the app overview showing the connected GitHub branch and a successful deployment
2. Amplify console: build history (several deploys)
3. Amplify console: Custom headers or Rewrites and redirects page
4. Browser DevTools → Network → response headers showing the CSP and HSTS headers on the live URL

---

## Screenshots of the portfolio (Communication, 25%)
Attach these from `docs/screenshots/`:
- `desktop-hero.jpg`: the hero, with the visible hint for the game
- `desktop-skills.jpg`, `desktop-projects.jpg`: the core sections
- `game-play.jpg`, `game-shield.jpg`, `game-station-samarkand.jpg`, `game-end.jpg`: the game
- `game-skies.jpg`: five cities, five skies
- `phone-strip.jpg`: the site on a phone
- `globe-day-night.jpg`: the real day/night globe
- `game-demo.webp`: a seven-second animated flight

---

## Completeness and usability (20%)
- **About Me, Skills and Tech Superpowers, Projects, Experience, Contact** are all in static HTML, so they work without JavaScript.
- A single-column layout on phones, with big touch controls in the game. City cards slide up from the bottom, and their buttons stay within reach even on a 320 px wide screen.
- An axe-core scan finds no accessibility violations. Lighthouse scores 100 for Accessibility, Best Practices and SEO.
- The text shows up before the 3D starts. The game is only downloaded when you press the camel. On slow devices the globe automatically drops its resolution and frame rate.

---

## What I learned
- **Shipping on AWS can be one `git push`.** Amplify Hosting gave me CI/CD, a global CDN and HTTPS without managing a server. Back in high school I ran sites on EC2 by hand, so the difference was huge.
- **Security headers are part of hosting, not an afterthought.** A strict CSP meant no inline scripts or styles anywhere, so I had to structure the code around it from day one.
- **3D on the web is a performance budget.** Instanced meshes, merged geometries, a trimmed three.js build (about 20% smaller), and pausing rendering when the tab is hidden made it smooth on phones.
- **Accessibility and fun can coexist.** Every game moment has a text equivalent, and reduced-motion users get a calm version.
- TODO: one personal sentence, e.g. what leading the Student Builder Group taught you, or what surprised you most.

## Challenges I hit
- **Keeping the game from blocking the portfolio.** The rules say the creative feature must not get in the way of navigation. I solved it with an overlay that closes on Esc, a focus trap, a text mode, and the same content in plain HTML.
- **WebGL on low-end phones.** The first versions stuttered. An adaptive quality system now drops resolution, then frame rate, when it can't hold about 40 fps.
- **A strict Content-Security-Policy vs. a 3D site.** Vendoring three.js and self-hosting the fonts meant nothing loads from other servers.
- **Robust startup.** One failing part of the page used to be able to leave the Play button dead. Now each part starts independently, so the game always opens.
- **Modules don't run from `file://`.** Local testing needs a static server, so the page explains that if someone opens the file directly.
- TODO: anything from the AWS side (first Amplify deploy, setting the rewrite rule, the custom domain, etc.)

## Built with
HTML, CSS, JavaScript (ES modules), three.js r186, WebGL, AWS Amplify Hosting, Amazon CloudFront. Built with Claude Code as an AI pair programmer.
