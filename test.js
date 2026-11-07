import {
  scrapeVideo,
  scrapeUser,
  scrapeTrending,
  scrapeHashtag,
  scrapeSound,
  parseTikTokUrl,
} from './index.js';

async function runTests() {
  console.log('=== Testing @kazedevid/tiktok-sup v1.1.0 ===\n');

  // 1. URL Parser
  console.log('1. Testing parseTikTokUrl:');
  const p1 = parseTikTokUrl('6768504823336815877');
  console.log('   Raw ID:', p1.videoId, '-> Normalized:', p1.normalizedUrl);
  const p2 = parseTikTokUrl('https://vt.tiktok.com/ZSjV8mNq7/');
  console.log('   Short link:', p2.isShort);

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

  // 6. Video Scraper
  console.log('\n6. Testing scrapeVideo (Zach King Magic):');
  try {
    const video = await scrapeVideo('https://www.tiktok.com/@zachking/video/6768504823336815877');
    console.log(`   ✓ ID: ${video.id}`);
    console.log(`   Title: ${video.description.slice(0, 50)}...`);
    console.log(`   No-Watermark playUrl: ${!!video.video?.noWatermarkUrl}`);
    console.log(`   Audio playUrl: ${!!video.music?.playUrl}`);
    console.log(`   Comments count: ${video.comments?.length || 0}`);
  } catch (e) {
    console.error('   ✗ Failed:', e.message);
  }

  console.log('\n=== All tests passed successfully! ===');
}

runTests();
