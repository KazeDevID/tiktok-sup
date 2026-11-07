# @kazedevid/tiktok-sup 🚀

> **Pure TikTok Web Scraper for Node.js (v1.1.0)** — Scrapes video metadata, direct no-watermark MP4 streams, MP3 audio, user profiles, comments, hashtags, and trending topics directly from `tiktok.com`. **100% pure web scraping with zero 3rd-party APIs, zero external proxies, and zero heavy browser automation.**

[![npm version](https://img.shields.io/npm/v/@kazedevid/tiktok-sup.svg?style=flat-square&color=cb0000)](https://www.npmjs.com/package/@kazedevid/tiktok-sup)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-KazeDevID%2Ftiktok--sup-black?style=flat-square&logo=github)](https://github.com/KazeDevID/tiktok-sup)

---

## ✨ Features

- 🎯 **100% Pure tiktok.com Scraping** — Zero reliance on rapidapi, tikwm, ssstik, or external proxies.
- ⚡ **Multi-Strategy Parser** — Extracts mobile reflow data, JSON payloads, and session cookies automatically.
- 🎬 **No-Watermark & Watermark Streams** — Provides `noWatermarkUrl` (direct playAddr) and standard `watermarkUrl`.
- 🖼️ **Photo Slideshows** — Full resolution photo carousel images extractor.
- 🎵 **Soundtrack Audio Extractor** — Direct MP3 play URLs, durations, and album artwork.
- 👤 **Full User Profile Scraper** — Followers, following, total hearts/likes, video count, bio link, secUid, and verified checkmarks.
- 💬 **Comments Extractor** — Parses initial comments list directly from the post payload.
- 📈 **Trending & Discover** — Real-time creators, viral hashtags with view counts, and popular audio tracks.
- 📥 **Built-in Downloader** — Helpers `downloadFile()` and `downloadBuffer()` for Telegram bots, Discord bots, and Express backends.
- 📦 **TypeScript Ready** — Includes complete type declarations out of the box (`index.d.ts`).
- 💻 **CLI Tool Included** — Instant terminal execution via `npx @kazedevid/tiktok-sup`.

---

## 📦 Installation

```bash
npm install @kazedevid/tiktok-sup
```

or with yarn / pnpm / bun:

```bash
yarn add @kazedevid/tiktok-sup
pnpm add @kazedevid/tiktok-sup
bun add @kazedevid/tiktok-sup
```

---

## 🚀 Usage Guide

### 1. Scrape Video & Download (No Watermark)

```javascript
import { scrapeVideo, downloadFile } from '@kazedevid/tiktok-sup';

// Works with full URLs, short links (vt.tiktok.com), or raw video IDs
const video = await scrapeVideo('https://www.tiktok.com/@zachking/video/6768504823336815877');

console.log('Title:', video.description);
console.log('Author:', video.author.nickname, `(@${video.author.username})`);
console.log('Views:', video.stats.views.toLocaleString());
console.log('Likes:', video.stats.likes.toLocaleString());
console.log('No-Watermark URL:', video.video?.noWatermarkUrl);
console.log('Audio Track:', video.music?.title, video.music?.playUrl);

// Download directly to disk:
const streamUrl = video.video.noWatermarkUrl || video.video.playUrl;
await downloadFile(streamUrl, 'video_clean.mp4', video.sessionCookies);
console.log('Downloaded clean MP4!');
```

### 2. Scrape User Profile

```javascript
import { scrapeUser } from '@kazedevid/tiktok-sup';

// Pass username with or without '@', or full profile URL
const user = await scrapeUser('mrbeast');

console.log('Name:', user.nickname);
console.log('Followers:', user.stats.followerCount.toLocaleString());
console.log('Total Likes:', user.stats.heartCount.toLocaleString());
console.log('Bio:', user.signature);
console.log('secUid:', user.secUid);
```

### 3. Get Media Buffer (for Bots / Telegram / Discord)

```javascript
import { scrapeVideo, downloadBuffer } from '@kazedevid/tiktok-sup';

const video = await scrapeVideo('https://vt.tiktok.com/...');
const buffer = await downloadBuffer(video.video.playUrl, video.sessionCookies);

// Send buffer to Telegram, Discord, or S3
// bot.sendVideo(chatId, buffer);
```

### 4. Trending & Hashtags

```javascript
import { scrapeTrending, scrapeHashtag } from '@kazedevid/tiktok-sup';

// Get trending items
const trending = await scrapeTrending('all'); // 'all' | 'creator' | 'hashtag' | 'music'

// Scrape hashtag stats
const tag = await scrapeHashtag('fyp');
console.log(tag.title, tag.views);
```

---

## 💻 CLI Usage

```bash
# Scrape video info
npx @kazedevid/tiktok-sup video "https://www.tiktok.com/@zachking/video/6768504823336815877"

# Scrape user profile
npx @kazedevid/tiktok-sup user khaby.lame

# List trending creators & sounds
npx @kazedevid/tiktok-sup trending

# Download video directly
npx @kazedevid/tiktok-sup download "https://vt.tiktok.com/..." clean.mp4
```

---

## 📚 API Reference

| Function | Parameters | Returns | Description |
| :--- | :--- | :--- | :--- |
| `scrapeVideo(url)` | `url: string` | `Promise<TikTokVideoResult>` | Scrapes full post metadata, no-watermark MP4, audio, and comments |
| `scrapeUser(username)` | `username: string` | `Promise<TikTokUserProfile>` | Extracts creator metrics, follower count, total likes, bio, and secUid |
| `scrapeTrending(cat)` | `category?: string` | `Promise<TikTokTrendingItem[]>` | Fetches live trending creators, hashtags, and viral sounds |
| `scrapeHashtag(tag)` | `tag: string` | `Promise<TikTokHashtagInfo>` | Extracts view counts and info for a hashtag |
| `scrapeSound(id)` | `soundIdOrUrl: string` | `Promise<TikTokSoundInfo>` | Scrapes soundtrack metadata and play links |
| `downloadFile(url, out, cookies)` | `url, path, cookies?` | `Promise<string>` | Downloads media buffer directly to a local file |
| `downloadBuffer(url, cookies)` | `url, cookies?` | `Promise<Buffer>` | Downloads media buffer directly into memory |
| `fetchMediaStream(url, cookies)` | `url, cookies?` | `Promise<Response>` | Stream response with official TikTok headers and referer |

---

## 📄 License

MIT © [KazeDevID](https://github.com/KazeDevID)
