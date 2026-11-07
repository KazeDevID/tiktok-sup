# @kazedevid/tiktok-sup

[![npm version](https://img.shields.io/npm/v/@kazedevid/tiktok-sup.svg?style=flat-square)](https://www.npmjs.com/package/@kazedevid/tiktok-sup)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org/)

A pure Node.js scraper library and CLI for **tiktok.com**. Extracts videos (clean no-watermark MP4 & watermarked MP4), **photo slideshows / carousels (HD images)**, creator profile feeds, user recent videos, hashtag feeds, sound feeds, engagement analytics, MP3 soundtracks, subtitle closed captions & transcripts, comments, and trending topics directly from official TikTok web pages.

**No 3rd-party APIs. No proxies required. 100% Pure tiktok.com web parsing.**

---

## Features

- Video Scraper & Downloader: Extracts clean, high-resolution MP4 streams without watermarks (`video.noWatermarkUrl`) and standard watermarked streams.
- Photo Slideshow Scraper: Automatically identifies photo carousels (`postType === "photo"`), providing an array of high-definition images with batch downloaders.
- Creator Video Feed Scraper: Extract all recent uploaded videos from any creator (`scrapeUserVideos("@username")`) with view counts, likes, duration, and direct video links.
- Hashtag Video Scraper: Extract top trending videos under any hashtag (`scrapeHashtagVideos("mlbb")`).
- Sound & Music Feed Scraper: Extract videos created using a specific audio track (`scrapeSoundVideos("soundId")`).
- Engagement & Virality Calculator: Calculate engagement rate %, like-to-view ratio %, virality score, and performance tier (`Viral`, `High`, `Average`, `Low`).
- Subtitle Transcripts Parser: WebVTT/SRT closed-caption parser returning timestamped dialogue cues and full-text transcripts.
- Creator Profile Stalker: Scrape follower count, following count, total likes, video count, bio, verified status, and high-res avatars.
- Comment Trees: Extracts top comments with author metadata and like counts.
- Discover & Trending: Live viral creators, trending hashtags, and popular music tracks.
- Downloader Helpers: Built-in `downloadFile()`, `downloadBuffer()`, `downloadPhoto()`, and `downloadAllPhotos()`.
- Dual Extraction Engine: Mobile Safari rehydration parser backed by Googlebot Schema.org engine for bypass resilience.
- CLI Executable: Run commands right in your terminal with `npx @kazedevid/tiktok-sup`.
- TypeScript Ready: Full type definitions included (`index.d.ts`).

---

## Installation

```bash
npm install @kazedevid/tiktok-sup
```

Or run via npx:

```bash
npx @kazedevid/tiktok-sup --help
```

---

## Quick Start

### 1. Scrape Video & Download Clean MP4 (No Watermark)

```javascript
import { scrapeVideo, downloadFile } from "@kazedevid/tiktok-sup";

const post = await scrapeVideo("https://vt.tiktok.com/ZSprKn3h8/");

console.log("Post Type:", post.postType); // "video" or "photo"
console.log("Title:", post.description);
console.log("Author:", post.author.nickname, "(@" + post.author.username + ")");
console.log("Views:", post.stats.views.toLocaleString());
console.log("Engagement Rate:", post.engagement.engagementRate + "%");

// Download clean no-watermark MP4 directly
const cleanUrl = post.video.noWatermarkUrl || post.video.playUrl;
await downloadFile(cleanUrl, "clean_video.mp4", post.sessionCookies);
console.log("Saved clean_video.mp4!");
```

---

### 2. Scrape Creator Recent Video Feed

Scrape recent videos published by any TikTok creator with play counts, likes, duration, and direct links:

```javascript
import { scrapeUserVideos } from "@kazedevid/tiktok-sup";

const feed = await scrapeUserVideos("@zachking");

console.log(`Creator: ${feed.author.nickname} (@${feed.author.username})`);
console.log(`Found ${feed.totalVideos} recent videos:`);

feed.videos.forEach((vid, i) => {
  console.log(`[${i + 1}] ${vid.description.slice(0, 40)}...`);
  console.log(`    Duration: ${vid.durationFormatted} | Views: ${vid.views.toLocaleString()} | Likes: ${vid.likes.toLocaleString()}`);
  console.log(`    URL: ${vid.url}`);
  console.log(`    Engagement: ${vid.engagementRate}% (${vid.benchmark})`);
});
```

---

### 3. Scrape Hashtag Trending Videos

Fetch top videos currently trending under a specific hashtag:

```javascript
import { scrapeHashtagVideos } from "@kazedevid/tiktok-sup";

const tagFeed = await scrapeHashtagVideos("mobilelegends");

console.log(`Hashtag #${tagFeed.tag} - ${tagFeed.videos.length} videos found`);
for (const vid of tagFeed.videos) {
  console.log(`- ${vid.description.slice(0, 50)} by @${vid.author.username} (${vid.views.toLocaleString()} views)`);
}
```

---

### 4. Scrape Sound / Music Feed

Discover videos that used a specific sound or song:

```javascript
import { scrapeSoundVideos } from "@kazedevid/tiktok-sup";

const soundFeed = await scrapeSoundVideos("7123456789012345678");
console.log(`Music: ${soundFeed.musicTitle} (${soundFeed.videos.length} videos)`);
```

---

### 5. Engagement & Virality Analytics

Calculate detailed engagement performance from raw interaction counts:

```javascript
import { calculateEngagement } from "@kazedevid/tiktok-sup";

const metrics = calculateEngagement({
  views: 531200,
  likes: 42100,
  comments: 890,
  shares: 1200,
  saves: 3400
});

console.log(metrics);
/*
{
  views: 531200,
  likes: 42100,
  comments: 890,
  shares: 1200,
  saves: 3400,
  totalEngagements: 47590,
  engagementRate: 8.96,
  likeRatio: 7.93,
  viralityScore: 41.2,
  benchmark: "High"
}
*/
```

---

### 6. Subtitles & Transcript Parser

Extract timestamped dialogue and full text from closed-caption URLs:

```javascript
import { scrapeVideo, scrapeTranscript } from "@kazedevid/tiktok-sup";

const post = await scrapeVideo("https://www.tiktok.com/@creator/video/123456789");
if (post.subtitles && post.subtitles.length > 0) {
  const transcript = await scrapeTranscript(post.subtitles[0].url);
  console.log(`Total words: ${transcript.totalWords}`);
  console.log(transcript.fullText);
}
```

---

### 7. Scrape Photo Slideshows (Carousels)

```javascript
import { scrapeVideo, downloadAllPhotos } from "@kazedevid/tiktok-sup";

const post = await scrapeVideo("https://www.tiktok.com/@creator/video/123456789");

if (post.postType === "photo" && post.photos) {
  console.log(`Found ${post.photos.length} photos!`);
  // Download all photos into a folder
  const savedFiles = await downloadAllPhotos(post.photos, "./my-photos", "slide", post.sessionCookies);
  console.log(`Saved ${savedFiles.length} photos to ./my-photos`);
}
```

---

### 8. Stalk / Scrape Creator Profile

```javascript
import { scrapeUser } from "@kazedevid/tiktok-sup";

const user = await scrapeUser("@zachking");
console.log("Username:", user.username);
console.log("Followers:", user.followers.toLocaleString());
console.log("Total Likes:", user.likes.toLocaleString());
console.log("Verified:", user.verified);

// You can also get their recent videos directly:
const feed = await user.getVideos();
console.log(`Fetched ${feed.videos.length} videos from profile.`);
```

---

## CLI Usage

You can run `@kazedevid/tiktok-sup` directly via npx without writing code:

```bash
# Scrape video info
npx @kazedevid/tiktok-sup video https://vt.tiktok.com/ZSprKn3h8/

# Download clean video (no watermark)
npx @kazedevid/tiktok-sup download https://vt.tiktok.com/ZSprKn3h8/ -o clean.mp4

# Scrape creator profile
npx @kazedevid/tiktok-sup user @zachking

# Scrape creator recent videos feed
npx @kazedevid/tiktok-sup user-videos @zachking -l 10

# Scrape hashtag trending videos
npx @kazedevid/tiktok-sup hashtag-videos mlbb -l 10

# Calculate engagement analytics
npx @kazedevid/tiktok-sup engagement --views 100000 --likes 12000 --shares 800 --comments 400

# Discover viral creators and trending hashtags
npx @kazedevid/tiktok-sup discover
```

---

## License

MIT © [KazeDevID](https://github.com/KazeDevID)
