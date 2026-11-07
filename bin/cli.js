#!/usr/bin/env node

/**
 * tiktok-sup CLI (v1.1.0)
 * Command line tool for scraping TikTok without 3rd party APIs
 */

import {
  scrapeVideo,
  scrapeUser,
  scrapeTrending,
  scrapeHashtag,
  scrapeSound,
  downloadFile,
} from '../index.js';

const args = process.argv.slice(2);
const command = args[0];
const target = args[1];

async function main() {
  if (!command || command === '--help' || command === '-h') {
    console.log(`
@kazedevid/tiktok-sup - Pure TikTok Web Scraper for Node.js (tiktok.com only)

Usage:
  npx @kazedevid/tiktok-sup video <url|id>          Scrape video metadata, no-watermark MP4 & audio
  npx @kazedevid/tiktok-sup user <username>         Scrape user profile and statistics
  npx @kazedevid/tiktok-sup trending [category]     List trending creators, hashtags or music
  npx @kazedevid/tiktok-sup hashtag <tag>           Scrape hashtag info and views
  npx @kazedevid/tiktok-sup sound <id|title>        Scrape audio track details
  npx @kazedevid/tiktok-sup download <url> [out]    Download no-watermark MP4 to file

Examples:
  npx @kazedevid/tiktok-sup video 6768504823336815877
  npx @kazedevid/tiktok-sup user mrbeast
  npx @kazedevid/tiktok-sup hashtag fyp
  npx @kazedevid/tiktok-sup download "https://vt.tiktok.com/..." ./myvideo.mp4
`);
    process.exit(0);
  }

  try {
    if (command === 'video') {
      if (!target) {
        console.error('Error: Please provide a TikTok video URL or ID.');
        process.exit(1);
      }
      console.log(`Scraping video ${target} directly from tiktok.com...`);
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
      const cat = args[1] || 'all';
      console.log(`Fetching trending items (${cat}) from tiktok.com...`);
      const data = await scrapeTrending(cat);
      console.log(JSON.stringify(data, null, 2));
    } else if (command === 'hashtag') {
      if (!target) {
        console.error('Error: Please provide a hashtag name.');
        process.exit(1);
      }
      const data = await scrapeHashtag(target);
      console.log(JSON.stringify(data, null, 2));
    } else if (command === 'sound') {
      if (!target) {
        console.error('Error: Please provide a sound ID or name.');
        process.exit(1);
      }
      const data = await scrapeSound(target);
      console.log(JSON.stringify(data, null, 2));
    } else if (command === 'download') {
      if (!target) {
        console.error('Error: Please provide a TikTok video URL or ID.');
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
      await downloadFile(streamUrl, outFile, data.sessionCookies);
      console.log(`Saved successfully to ${outFile}!`);
    } else {
      console.error(
        `Unknown command: "${command}". Run "@kazedevid/tiktok-sup --help" for instructions.`
      );
      process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
