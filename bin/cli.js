#!/usr/bin/env node

/**
 * tiktok-sup CLI (v1.3.0)
 * Command line tool for scraping TikTok without 3rd party APIs
 */

import {
  scrapeVideo,
  scrapeUser,
  scrapeTrending,
  scrapeHashtag,
  scrapeSound,
  downloadFile,
  downloadAllPhotos,
  downloadAudio,
  batchDownload,
} from '../index.js';

const args = process.argv.slice(2);
const command = args[0];
const target = args[1];

async function main() {
  if (!command || command === '--help' || command === '-h') {
    console.log(`
@kazedevid/tiktok-sup v1.2.0 - Pure TikTok Web Scraper for Node.js (tiktok.com only)

Usage:
  npx @kazedevid/tiktok-sup video <url|id>          Scrape video or photo post metadata
  npx @kazedevid/tiktok-sup photo <url|id>          Scrape photo carousel & image URLs
  npx @kazedevid/tiktok-sup user <username>         Scrape user profile and statistics
  npx @kazedevid/tiktok-sup trending [category]     List trending creators, hashtags or music
  npx @kazedevid/tiktok-sup hashtag <tag>           Scrape hashtag info and views
  npx @kazedevid/tiktok-sup sound <id|title>        Scrape audio track details
  npx @kazedevid/tiktok-sup download <url> [out]    Download no-watermark MP4 to file
  npx @kazedevid/tiktok-sup download-photos <url>   Download all photos from a slideshow
  npx @kazedevid/tiktok-sup audio <url> [out.mp3]   Extract and download audio track (MP3)
  npx @kazedevid/tiktok-sup batch <u1,u2,...> [dir] Batch download multiple videos/photos

Examples:
  npx @kazedevid/tiktok-sup video 6768504823336815877
  npx @kazedevid/tiktok-sup photo https://www.tiktok.com/@tiktok/photo/7703881354496281863
  npx @kazedevid/tiktok-sup user mrbeast
  npx @kazedevid/tiktok-sup hashtag fyp
  npx @kazedevid/tiktok-sup download "https://vt.tiktok.com/..." ./clean.mp4
  npx @kazedevid/tiktok-sup download-photos "https://www.tiktok.com/@user/photo/..." ./my_slides
`);
    process.exit(0);
  }

  try {
    if (command === 'video' || command === 'photo') {
      if (!target) {
        console.error('Error: Please provide a TikTok URL or ID.');
        process.exit(1);
      }
      console.log(`Scraping ${target} directly from tiktok.com...`);
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

      if (data.postType === 'photo' || data.isPhoto) {
        console.log(`This post is a photo slideshow (${data.photos?.length || 0} images). Downloading all photos instead...`);
        const outDir = args[2] || `./photos_${data.id}`;
        const saved = await downloadAllPhotos(data.photos || [], outDir, data.sessionCookies);
        console.log(`Saved ${saved.length} photos into ${outDir}`);
        process.exit(0);
      }

      const streamUrl = data.video?.noWatermarkUrl || data.video?.playUrl || data.video?.downloadUrl;
      if (!streamUrl) {
        console.error('No video stream URL found for this post.');
        process.exit(1);
      }

      const outFile = args[2] || `${data.id || 'tiktok_video'}_clean.mp4`;
      console.log(`Downloading stream to ${outFile}...`);
      await downloadFile(streamUrl, outFile, data.sessionCookies);
      console.log(`Saved successfully to ${outFile}!`);
    } else if (command === 'audio') {
      if (!target) {
        console.error('Error: Please provide a TikTok video or photo URL.');
        process.exit(1);
      }
      console.log(`Fetching audio for ${target}...`);
      const data = await scrapeVideo(target);
      if (!data.music?.playUrl) {
        console.error('No audio soundtrack found for this post.');
        process.exit(1);
      }
      const outFile = args[2] || `${data.id}_audio.mp3`;
      console.log(`Downloading audio (${data.music.title}) to ${outFile}...`);
      await downloadAudio(data.music.playUrl, outFile, data.sessionCookies);
      console.log(`Saved audio soundtrack successfully to ${outFile}!`);
    } else if (command === 'batch') {
      if (!target) {
        console.error('Error: Please provide comma-separated TikTok URLs or a file path.');
        process.exit(1);
      }
      let urlList = [];
      if (fs.existsSync(target)) {
        urlList = fs.readFileSync(target, 'utf-8').split(/\r?\n/).map(u => u.trim()).filter(Boolean);
      } else {
        urlList = target.split(',').map(u => u.trim()).filter(Boolean);
      }
      const outDir = args[2] || './batch_downloads';
      console.log(`Batch downloading ${urlList.length} items to ${outDir}...`);
      const results = await batchDownload(urlList, outDir, {
        onProgress: (p) => console.log(`[${p.current}/${p.total}] ${p.item ? (p.item.success ? "✓ Saved " + p.item.id : "✗ " + p.item.error) : ""}`)
      });
      console.log(`Batch download complete: ${results.filter(r => r.success).length}/${results.length} succeeded.`);
    } else if (command === 'download-photos') {
      if (!target) {
        console.error('Error: Please provide a TikTok photo URL or ID.');
        process.exit(1);
      }
      console.log(`Fetching photo post ${target}...`);
      const data = await scrapeVideo(target);
      if (!data.photos || data.photos.length === 0) {
        console.error('This post does not contain any photo slides.');
        process.exit(1);
      }

      const outDir = args[2] || `./photos_${data.id}`;
      console.log(`Downloading ${data.photos.length} photos into ${outDir}...`);
      const saved = await downloadAllPhotos(data.photos, outDir, data.sessionCookies);
      console.log(`Successfully saved ${saved.length} photos to ${outDir}!`);
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
