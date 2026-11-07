# tiktok-sup 🚀

> **Pure TikTok Web Scraper for Node.js** — Scrapes video metadata, direct MP4 streams, MP3 audio, user profiles, comments, and trending hashtags directly from `tiktok.com`. **100% pure web scraping with zero 3rd-party APIs or proxies.**

[![npm version](https://img.shields.io/npm/v/tiktok-sup.svg?style=flat-square&color=cb0000)](https://www.npmjs.com/package/tiktok-sup)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-KazeDevID%2Ftiktok--sup-black?style=flat-square&logo=github)](https://github.com/KazeDevID/tiktok-sup)

---

## ✨ Features

- 🎯 **Pure tiktok.com scraping** — Zero reliance on rapidapi, tikwm, ssstik, or external proxies.
- ⚡ **Lightning Fast** — Direct lightweight parsing of TikTok mobile SSR rehydration & web data.
- 🎬 **Video & Photo Slides** — Supports standard video posts, short links (`vt.tiktok.com`, `vm.tiktok.com`), and multi-image photo carousels.
- 🎵 **Audio / Music Extractor** — Extract sound titles, author names, durations, and direct audio stream URLs.
- 👤 **Full User Profile Scraper** — Followers, following count, total likes/hearts, video counts, bio, secUid, and verified badges.
- 💬 **Comments Extractor** — Scrapes initial comment lists directly from the post data.
- 📈 **Trending Explorer** — Discovers trending creators, hashtags, and viral sounds.
- 🛡️ **Session Cookie Handling** — Returns session cookies required to stream video and audio directly from TikTok CDN.
- 📦 **TypeScript Support** — Full type definitions out of the box.
- 💻 **CLI Included** — Run directly via `npx tiktok-sup` in your terminal.

---

## 📦 Installation

```bash
npm install tiktok-sup
```

or with yarn / pnpm:

```bash
yarn add tiktok-sup
# or
pnpm add tiktok-sup
```

---

## 🚀 Quick Start

### 1. Scrape Video Metadata & Stream Links

```javascript
import { scrapeVideo } from 'tiktok-sup';

// Works with any TikTok URL (desktop, mobile, or vt.tiktok.com short links)
const video = await scrapeVideo('https://www.tiktok.com/@zachking/video/6768504823336815877');

console.log('Title/Desc:', video.description);
console.log('Author:', video.author.nickname, `(@${video.author.username})`);
console.log('Stats:', video.stats); // { views, likes, comments, shares, bookmarks }
console.log('Video Play URL:', video.video?.playUrl);
console.log('Music:', video.music?.title, '-', video.music?.playUrl);
```

### 2. Scrape User Profile

```javascript
import { scrapeUser } from 'tiktok-sup';

const profile = await scrapeUser('mrbeast');

console.log('Name:', profile.nickname);
console.log('Followers:', profile.stats.followerCount.toLocaleString());
console.log('Total Likes:', profile.stats.heartCount.toLocaleString());
console.log('Bio:', profile.signature);
console.log('Verified:', profile.verified);
```

### 3. Explore Trending Creators & Hashtags

```javascript
import { scrapeTrending } from 'tiktok-sup';

const trending = await scrapeTrending();
trending.forEach(item => {
  console.log(`[${item.type}] ${item.title} - ${item.subTitle || ''}`);
});
```

### 4. Downloading or Streaming Videos Directly

TikTok CDN requires session cookies and matching referer headers to stream:

```javascript
import { scrapeVideo, fetchMediaStream } from 'tiktok-sup';
import fs from 'fs';

const video = await scrapeVideo('https://vt.tiktok.com/...');
const streamUrl = video.video.downloadUrl || video.video.playUrl;

// fetchMediaStream automatically attaches TikTok referer and session cookies
const response = await fetchMediaStream(streamUrl, video.sessionCookies);
const buffer = Buffer.from(await response.arrayBuffer());

fs.writeFileSync('video.mp4', buffer);
console.log('Downloaded video.mp4 successfully!');
```

---

## 💻 CLI Usage

You can use `tiktok-sup` directly in your terminal without writing code:

```bash
# Scrape video info
npx tiktok-sup video "https://www.tiktok.com/@zachking/video/6768504823336815877"

# Scrape user profile
npx tiktok-sup user khaby.lame

# List trending topics
npx tiktok-sup trending

# Download video MP4 directly
npx tiktok-sup download "https://vt.tiktok.com/..." output.mp4
```

---

## 📚 API Reference

### `scrapeVideo(url: string): Promise<TikTokVideoResult>`
Parses full video metadata, author info, statistics, audio URLs, direct stream URLs, and comments.

### `scrapeUser(username: string): Promise<TikTokUserProfile>`
Scrapes a user profile by username handle (with or without `@`).

### `scrapeTrending(): Promise<TikTokTrendingItem[]>`
Fetches trending creators, hashtags, and sound tracks from `tiktok.com/node/share/discover`.

### `parseTikTokUrl(url: string)`
Extracts videoId and username from any format.

### `fetchMediaStream(url: string, cookieStr?: string): Promise<Response>`
Fetches the raw media buffer with TikTok headers.

---

## 📄 License

MIT © [KazeDevID](https://github.com/KazeDevID)
