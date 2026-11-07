#!/usr/bin/env node

/**
 * tiktok-sup CLI
 * Command line tool for scraping TikTok without 3rd party APIs
 */

import { scrapeVideo, scrapeUser, scrapeTrending } from '../index.js';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const command = args[0];
const target = args[1];

async function main() {
  if (!command || command === '--help' || command === '-h') {
    console.log(`
tiktok-sup - Pure TikTok Web Scraper for Node.js (tiktok.com only)

Usage:
  npx tiktok-sup video <url>            Scrape full video metadata, audio & stream links
  npx tiktok-sup user <username>        Scrape user profile and statistics
  npx tiktok-sup trending               List trending creators, hashtags and music
  npx tiktok-sup download <url> [out]   Download video MP4 to file

Examples:
  npx tiktok-sup video https://www.tiktok.com/@zachking/video/6768504823336815877
  npx tiktok-sup user khaby.lame
  npx tiktok-sup download https://vt.tiktok.com/ZS... ./myvideo.mp4
`);
    process.exit(0);
  }

  try {
    if (command === 'video') {
      if (!target) {
        console.error('Error: Please provide a TikTok video URL.');
        process.exit(1);
      }
      console.log(`Scraping video from ${target} directly from tiktok.com...`);
      const data = await scrapeVideo(target);
      console.log(JSON.stringify(data, null, 2));
    } else if (command === 'user') {
      if (!target) {
        console.error('Error: Please provide a TikTok username.');
        process.exit(1);
      }
      console.log(`Scraping profile @${target} directly from tiktok.com...`);
      const data = await scrapeUser(target);
      console.log(JSON.stringify(data, null, 2));
    } else if (command === 'trending') {
      console.log('Fetching trending creators, hashtags and music from tiktok.com...');
      const data = await scrapeTrending();
      console.log(JSON.stringify(data, null, 2));
    } else if (command === 'download') {
      if (!target) {
        console.error('Error: Please provide a TikTok video URL.');
        process.exit(1);
      }
      console.log(`Resolving stream URL for ${target}...`);
      const data = await scrapeVideo(target);
      const streamUrl = data.video?.downloadUrl || data.video?.playUrl;
      if (!streamUrl) {
        console.error('No video stream URL found for this post.');
        process.exit(1);
      }

      const outFile = args[2] || `${data.id || 'tiktok_video'}.mp4`;
      console.log(`Downloading stream to ${outFile}...`);
      const res = await fetch(streamUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15',
          'Referer': 'https://www.tiktok.com/',
          ...(data.sessionCookies ? { Cookie: data.sessionCookies } : {}),
        },
      });

      if (!res.ok) {
        throw new Error(`Download failed: HTTP ${res.status}`);
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(path.resolve(outFile), buffer);
      console.log(`Saved ${buffer.length} bytes to ${outFile}!`);
    } else {
      console.error(`Unknown command: "${command}". Run "tiktok-sup --help" for instructions.`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
