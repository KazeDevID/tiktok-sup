#!/usr/bin/env node

/**
 * tiktok-sup CLI (v1.4.0)
 * Command line tool for scraping TikTok directly from tiktok.com
 */

import {
  scrapeVideo,
  scrapeUser,
  scrapeTrending,
  scrapeHashtag,
  scrapeSound,
  scrapeComments,
  scrapeOEmbed,
  scrapeSearch,
  downloadFile,
  downloadAllPhotos,
  downloadAudio,
  batchDownload,
} from "../index.js";

const args = process.argv.slice(2);
const command = args[0];
const target = args[1];
const param3 = args[2];

async function main() {
  if (!command || command === "--help" || command === "-h") {
    console.log(`@kazedevid/tiktok-sup v1.4.0 - Pure TikTok Web Scraper & Media Engine

Usage:
  tiktok-sup video <url|id>          Scrape video or photo post metadata
  tiktok-sup photo <url|id>          Scrape photo carousel & image URLs
  tiktok-sup comments <url> [count]  Scrape live post comments
  tiktok-sup oembed <url>            Generate official TikTok oEmbed iframe
  tiktok-sup search <query> [cat]    Search creators, hashtags, and viral sounds
  tiktok-sup user <username>         Scrape user profile and statistics
  tiktok-sup trending [category]     List trending creators, hashtags or music
  tiktok-sup hashtag <tag>           Scrape hashtag info and views
  tiktok-sup sound <id|title>        Scrape audio track details
  tiktok-sup download <url> [out]    Download no-watermark MP4 to file
  tiktok-sup download-photos <url>   Download all photos from a slideshow
  tiktok-sup audio <url> [out.mp3]   Extract and download audio track (MP3)
  tiktok-sup batch <u1,u2,...> [dir] Batch download multiple videos/photos

Examples:
  npx @kazedevid/tiktok-sup video "https://vt.tiktok.com/ZSpr3DYnu/"
  npx @kazedevid/tiktok-sup comments "https://vt.tiktok.com/ZSpr3DYnu/" 10
  npx @kazedevid/tiktok-sup search "mlbb"
  npx @kazedevid/tiktok-sup oembed "https://vt.tiktok.com/ZSpr3DYnu/"
  npx @kazedevid/tiktok-sup audio "https://vt.tiktok.com/ZSpr3DYnu/" ./music.mp3
  npx @kazedevid/tiktok-sup batch "https://vt.tiktok.com/ZSpr3DYnu/,https://vt.tiktok.com/ZSprKn3h8/" ./media
`);
    process.exit(0);
  }

  try {
    if (command === "video" || command === "photo") {
      if (!target) {
        console.error("Error: Please provide a TikTok URL or ID.");
        process.exit(1);
      }
      console.log(`Scraping ${target} directly from tiktok.com...`);
      const data = await scrapeVideo(target);
      console.log(JSON.stringify(data, null, 2));
    } else if (command === "comments") {
      if (!target) {
        console.error("Error: Please provide a TikTok URL or post ID.");
        process.exit(1);
      }
      const count = param3 ? parseInt(param3, 10) : 20;
      console.log(`Fetching comments for ${target} (count: ${count})...`);
      const res = await scrapeComments(target, { count });
      console.log(`Found ${res.total} comments (showing ${res.comments.length}):
`);
      for (const c of res.comments) {
        console.log(`[${c.user.nickname} (@${c.user.username})] (${c.likes} likes):`);
        console.log(`  ${c.text}
`);
      }
    } else if (command === "search") {
      if (!target) {
        console.error("Error: Please provide a search query.");
        process.exit(1);
      }
      const cat = param3 || "all";
      console.log(`Searching tiktok.com for "${target}" (${cat})...`);
      const res = await scrapeSearch(target, cat);
      console.log(`Found ${res.items.length} results:
`);
      for (const item of res.items) {
        console.log(`[${item.type.toUpperCase()}] ${item.title} ${item.subTitle || ""}`);
      }
    } else if (command === "oembed") {
      if (!target) {
        console.error("Error: Please provide a TikTok video URL.");
        process.exit(1);
      }
      const res = await scrapeOEmbed(target);
      console.log(res.html);
    } else if (command === "user") {
      if (!target) {
        console.error("Error: Please provide a username.");
        process.exit(1);
      }
      console.log(`Scraping profile @${target}...`);
      const data = await scrapeUser(target);
      console.log(JSON.stringify(data, null, 2));
    } else if (command === "trending") {
      const category = target || "all";
      console.log(`Scraping trending (${category})...`);
      const data = await scrapeTrending(category);
      console.log(JSON.stringify(data, null, 2));
    } else if (command === "hashtag") {
      if (!target) {
        console.error("Error: Please provide a hashtag.");
        process.exit(1);
      }
      const data = await scrapeHashtag(target);
      console.log(JSON.stringify(data, null, 2));
    } else if (command === "sound") {
      if (!target) {
        console.error("Error: Please provide a sound ID or title.");
        process.exit(1);
      }
      const data = await scrapeSound(target);
      console.log(JSON.stringify(data, null, 2));
    } else if (command === "download") {
      if (!target) {
        console.error("Error: Please provide a TikTok URL.");
        process.exit(1);
      }
      const outPath = param3 || "tiktok_clean.mp4";
      console.log(`Scraping and downloading video to ${outPath}...`);
      const post = await scrapeVideo(target);
      if (post.isPhoto) {
        console.error("Error: This post is a photo carousel. Use download-photos command instead.");
        process.exit(1);
      }
      if (post.download) {
        await post.download(outPath);
      } else {
        const streamUrl = post.video?.noWatermarkUrl || post.video?.playUrl;
        if (!streamUrl) throw new Error("No playable clean stream URL found");
        await downloadFile(streamUrl, outPath, post.sessionCookies);
      }
      console.log(`Successfully saved clean video: ${outPath}`);
    } else if (command === "audio") {
      if (!target) {
        console.error("Error: Please provide a TikTok URL.");
        process.exit(1);
      }
      const outPath = param3 || "soundtrack.mp3";
      console.log(`Scraping and extracting audio track to ${outPath}...`);
      const post = await scrapeVideo(target);
      if (!post.music?.playUrl) {
        console.error("Error: No audio soundtrack URL found in this post.");
        process.exit(1);
      }
      if (post.downloadAudio) {
        await post.downloadAudio(outPath);
      } else {
        await downloadAudio(post.music.playUrl, outPath, post.sessionCookies);
      }
      console.log(`Successfully saved soundtrack: ${outPath}`);
    } else if (command === "download-photos") {
      if (!target) {
        console.error("Error: Please provide a TikTok slideshow URL.");
        process.exit(1);
      }
      const outDir = param3 || "./photos";
      console.log(`Scraping photo slideshow ${target}...`);
      const post = await scrapeVideo(target);
      if (!post.isPhoto || !post.photos || post.photos.length === 0) {
        console.error("Error: Post is not a photo slideshow.");
        process.exit(1);
      }
      if (post.downloadPhotos) {
        const files = await post.downloadPhotos(outDir);
        console.log(`Saved ${files.length} photos to ${outDir}`);
      } else {
        const files = await downloadAllPhotos(post.photos, outDir, post.sessionCookies);
        console.log(`Saved ${files.length} photos to ${outDir}`);
      }
    } else if (command === "batch") {
      if (!target) {
        console.error("Error: Please provide comma-separated URLs (e.g. u1,u2,u3).");
        process.exit(1);
      }
      const urls = target.split(",").map(u => u.trim()).filter(Boolean);
      const outDir = param3 || "./downloads";
      console.log(`Batch downloading ${urls.length} items to ${outDir}...`);
      const results = await batchDownload(urls, outDir, {
        onProgress: ({ current, total, item }) => {
          if (item?.success) {
            console.log(`  [${current}/${total}] Done ${item.id} (${item.postType})`);
          }
        }
      });
      console.log(`Batch download finished. ${results.filter(r => r.success).length}/${results.length} succeeded.`);
    } else {
      console.error(`Unknown command: ${command}. Run tiktok-sup --help for usage.`);
      process.exit(1);
    }
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();
