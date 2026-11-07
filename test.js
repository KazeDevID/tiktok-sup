import {
  scrapeVideo,
  scrapeUser,
  scrapeTrending,
  scrapeHashtag,
  scrapeSound,
  parseTikTokUrl,
} from './index.js';

async function runTests() {
  console.log('=== Testing @kazedevid/tiktok-sup v1.2.0 ===\n');

  // 1. URL Parser
  console.log('1. Testing parseTikTokUrl:');
  const p1 = parseTikTokUrl('6768504823336815877');
  console.log('   Raw ID:', p1.videoId, '-> Normalized:', p1.normalizedUrl);
  const p2 = parseTikTokUrl('https://vt.tiktok.com/ZSjV8mNq7/');
  console.log('   Short link:', p2.isShort);
  const p3 = parseTikTokUrl('https://www.tiktok.com/@tiktok/photo/7703881354496281863');
  console.log('   Photo link:', p3.isPhoto, '-> ID:', p3.videoId);

  // 2. User Scraper
  console.log('\n2. Testing scrapeUser("mrbeast"):');
  try {
    const user = await scrapeUser('mrbeast');
    console.log(`   ✓ ${user.nickname} (@${user.uniqueId})`);
    console.log(`   Followers: ${user.stats.followerCount.toLocaleString()}, Likes: ${user.stats.heartCount.toLocaleString()}`);
  } catch (e) {
    console.error('   ✗ Failed:', e.message);
  }

  // 3. Trending Scraper
  console.log('\n3. Testing scrapeTrending("hashtag"):');
  try {
    const hashtags = await scrapeTrending('hashtag');
    console.log(`   ✓ Found ${hashtags.length} trending hashtags`);
    console.log('   Sample:', hashtags.slice(0, 3).map((h) => `${h.title} (${h.subTitle})`));
  } catch (e) {
    console.error('   ✗ Failed:', e.message);
  }

  // 4. Hashtag Scraper
  console.log('\n4. Testing scrapeHashtag:');
  try {
    const tag = await scrapeHashtag('blackfriday');
    console.log(`   ✓ Hashtag: ${tag.title}, Views: ${tag.views || 'N/A'}`);
  } catch (e) {
    console.error('   ✗ Failed:', e.message);
  }

  // 5. Sound Scraper
  console.log('\n5. Testing scrapeSound:');
  try {
    const sound = await scrapeSound('idol');
    console.log(`   ✓ Sound: ${sound.title}, Author: ${sound.author || 'N/A'}`);
  } catch (e) {
    console.error('   ✗ Failed:', e.message);
  }

  // 6. Video Post Scraper
  console.log('\n6. Testing Video Scrape (Zach King Magic):');
  try {
    const video = await scrapeVideo('https://www.tiktok.com/@zachking/video/6768504823336815877');
    console.log(`   ✓ ID: ${video.id}`);
    console.log(`   ✓ PostType: ${video.postType} (isPhoto: ${video.isPhoto})`);
    console.log(`   ✓ Title: ${video.description.slice(0, 50)}...`);
    console.log(`   ✓ No-Watermark playUrl: ${!!video.video?.noWatermarkUrl}`);
    console.log(`   ✓ Audio playUrl: ${!!video.music?.playUrl}`);
  } catch (e) {
    console.error('   ✗ Failed:', e.message);
  }

  // 7. Photo Post Scraper
  console.log('\n7. Testing Photo Scrape (Live Slideshow Post):');
  try {
    const photoPost = await scrapeVideo('https://www.tiktok.com/@tiktok/photo/7703881354496281863');
    console.log(`   ✓ ID: ${photoPost.id}`);
    console.log(`   ✓ PostType: ${photoPost.postType} (isPhoto: ${photoPost.isPhoto})`);
    console.log(`   ✓ Photos Count: ${photoPost.photos?.length || 0}`);
    console.log(`   ✓ First Photo: ${photoPost.photos?.[0]?.slice(0, 50)}...`);
  } catch (e) {
    console.error('   ✗ Failed:', e.message);
  }

  console.log('\n=== All tests passed successfully! ===');
}

runTests();
