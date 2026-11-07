# @kazedevid/tiktok-sup

[![npm version](https://img.shields.io/npm/v/@kazedevid/tiktok-sup.svg?style=flat-square)](https://www.npmjs.com/package/@kazedevid/tiktok-sup)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org/)

A pure Node.js scraper library and CLI for **tiktok.com**. 
Extracts videos (clean no-watermark MP4 & watermarked MP4), **photo slideshows / carousels (HD images)**, creator profiles, MP3 soundtrack audio, subtitle closed captions, comments, hashtags, and trending topics directly from official TikTok web pages.

**No 3rd-party APIs. No proxies required. 100% Pure tiktok.com web parsing.**

---

## ✨ Features

- 🎥 **Video Scraper**: Extracts clean, high-resolution MP4 streams without watermarks (`video.noWatermarkUrl`) and standard watermarked streams.
- 🖼️ **Photo Slideshow Scraper**: Automatically identifies photo carousels (`postType === 'photo'`), providing array of high-definition images with backup CDN links.
- 🎵 **Soundtrack Audio**: Direct MP3 audio streams for background soundtracks.
- 📝 **Subtitles & Captions**: Extracts closed captions (`.vtt`, `.srt`) across all available languages.
- 👤 **Creator Profile**: Stalk/scrape follower count, following count, total likes, video count, bio, and high-res avatars.
- 💬 **Comment Trees**: Extracts top comments with author metadata and like counts.
- 🔥 **Discover & Trending**: Live viral creators, trending hashtags, and popular music tracks.
- 💾 **Downloader Helpers**: Built-in `downloadFile()`, `downloadBuffer()`, `downloadPhoto()`, and `downloadAllPhotos()`.
- ⚡ **Dual Extraction Engine**: Mobile Safari rehydration parser backed by Googlebot Schema.org engine for bypass resilience.
- 💻 **CLI Executable**: Run commands right in your terminal with `npx @kazedevid/tiktok-sup`.
- 📘 **TypeScript Ready**: Full type definitions included (`index.d.ts`).

---

## 📦 Installation

```bash
npm install @kazedevid/tiktok-sup
```

---

## 🚀 Quick Start

### 1. Scrape Video & Download No-Watermark MP4

```javascript
import { scrapeVideo, downloadFile } from '@kazedevid/tiktok-sup';

const post = await scrapeVideo('https://www.tiktok.com/@zachking/video/6768504823336815877');

console.log('Post Type:', post.postType); // 'video'
console.log('Title:', post.description);
console.log('Author:', post.author.nickname, '(@' + post.author.username + ')');
console.log('Views:', post.stats.views.toLocaleString());
console.log('Clean MP4:', post.video?.noWatermarkUrl);

// Option A: Direct one-line download (recommended - auto attaches session cookies)
await post.download('clean_video.mp4');
console.log('Saved clean_video.mp4!');

// Option B: Using downloadFile helper
const cleanUrl = post.video.noWatermarkUrl || post.video.playUrl;
await downloadFile(cleanUrl, 'clean_video.mp4', post.sessionCookies);

// Option C: In-memory Buffer (e.g. for Telegram bot or Discord bot)
const videoBuffer = await post.downloadBuffer();
console.log('Downloaded buffer bytes:', videoBuffer.length);
```

### 2. Scrape Photo Slideshow / Carousel

```javascript
import { scrapeVideo, downloadAllPhotos } from '@kazedevid/tiktok-sup';

const post = await scrapeVideo('https://www.tiktok.com/@tiktok/photo/7703881354496281863');

console.log('Post Type:', post.postType); // 'photo'
console.log('Is Photo:', post.isPhoto); // true
console.log(`Total Slides: ${post.photos.length}`);

// Download all photos into a folder
const savedFiles = await downloadAllPhotos(post.photos, './my_slides', post.sessionCookies);
console.log('Downloaded files:', savedFiles);
```

### 3. In-Memory Buffer (Bots & Cloud Storage)

```javascript
import { scrapeVideo, downloadBuffer } from '@kazedevid/tiktok-sup';

const post = await scrapeVideo('https://vt.tiktok.com/...');
const buffer = await downloadBuffer(post.video.playUrl, post.sessionCookies);

// Ready for Telegram, Discord bot, or S3 upload
console.log('Buffer bytes:', buffer.length);
```

### 4. Scrape Creator Profile

```javascript
import { scrapeUser } from '@kazedevid/tiktok-sup';

const profile = await scrapeUser('mrbeast');

console.log('Nickname:', profile.nickname);
console.log('Followers:', profile.stats.followerCount.toLocaleString());
console.log('Total Likes:', profile.stats.heartCount.toLocaleString());
console.log('Bio:', profile.signature);
```

### 5. Scrape Trending Discovery

```javascript
import { scrapeTrending } from '@kazedevid/tiktok-sup';

const hashtags = await scrapeTrending('hashtag');
console.log('Trending hashtags:', hashtags.map(h => h.title));

const creators = await scrapeTrending('creator');
console.log('Top creators:', creators.map(c => c.title));
```

---

## 💻 CLI Usage

You can run the scraper directly in your terminal using `npx`:

```bash
# Scrape video or photo metadata
npx @kazedevid/tiktok-sup video "https://www.tiktok.com/@zachking/video/6768504823336815877"

# Scrape photo slideshow
npx @kazedevid/tiktok-sup photo "https://www.tiktok.com/@user/photo/..."

# Download clean video
npx @kazedevid/tiktok-sup download "https://vt.tiktok.com/..." ./clean.mp4

# Download all photos from a slideshow
npx @kazedevid/tiktok-sup download-photos "https://www.tiktok.com/@user/photo/..." ./my_folder

# Scrape creator profile
npx @kazedevid/tiktok-sup user mrbeast

# Scrape trending topics
npx @kazedevid/tiktok-sup trending hashtag

# Inspect hashtag
npx @kazedevid/tiktok-sup hashtag fyp
```

---

## 📖 API Reference (v1.2.0)

| Function | Arguments | Returns | Description |
| :--- | :--- | :--- | :--- |
| `scrapeVideo(url)` | `url: string` | `Promise<TikTokVideoResult>` | Scrapes video (no-watermark MP4) or photo post (all slide images), author, stats, and comments. |
| `scrapeUser(username)` | `username: string` | `Promise<TikTokUserProfile>` | Extracts followers, following, likes, bio, and avatar. |
| `scrapeTrending(category?)` | `category?: 'all' \| 'creator' \| 'hashtag' \| 'music'` | `Promise<TikTokTrendingItem[]>` | Live discover feed from tiktok.com. |
| `scrapeHashtag(tag)` | `tag: string` | `Promise<TikTokHashtagInfo>` | Challenge view count, title, and cover. |
| `scrapeSound(idOrUrl)` | `idOrUrl: string` | `Promise<TikTokSoundInfo>` | Soundtrack title, author, and audio URL. |
| `downloadFile(url, out, cookies?)` | `url, outputPath, cookies?` | `Promise<string>` | Downloads media file to local disk. |
| `downloadBuffer(url, cookies?)` | `url, cookies?` | `Promise<Buffer>` | In-memory Buffer for bots. |
| `downloadPhoto(url, out, cookies?)` | `url, outputPath, cookies?` | `Promise<string>` | Downloads single photo slide. |
| `downloadAllPhotos(urls, dir, cookies?)` | `urls: string[], outDir, cookies?` | `Promise<string[]>` | Batch downloads all photo slides. |
| `parseTikTokUrl(url)` | `url: string` | `object` | Normalizes IDs, shortlinks, video and photo URLs. |

---


---

## 🛠️ What's New in v1.2.1

- 🐛 **Fixed HTTP 403 Forbidden on CDN Video Downloads**: Resolved Akamai CDN authentication rejections by implementing a unified Cookie Jar that guarantees `tt_chain_token`, `ttwid`, and session tokens match TikTok's signed video CDN URLs (`tk=tt_chain_token`).
- 🚀 **New Direct Download Helpers**:
  - `await post.download("video.mp4")` - Automatically downloads the no-watermark stream with verified session cookies.
  - `await post.downloadBuffer()` - Downloads stream into an in-memory `Buffer` for bots, cloud storage (S3/GCS), or APIs.
  - `await post.downloadPhotos("./dir")` - Directly downloads all carousel images.
- ⚡ **Intelligent Byte-Range Fallback**: `fetchMediaStream()` now automatically adds `Range: bytes=0-` fallback when CDN nodes challenge standard GET requests.

## 📄 License

MIT © [KazeDevID](https://github.com/KazeDevID)
