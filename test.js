import { scrapeVideo, scrapeUser, scrapeTrending } from './index.js';

async function runTests() {
  console.log('--- Testing tiktok-sup library ---');

  // Test 1: scrapeUser
  console.log('\n1. Testing scrapeUser("mrbeast")...');
  try {
    const user = await scrapeUser('mrbeast');
    console.log('✓ Success:', user.nickname, `(${user.uniqueId})`, 'Followers:', user.stats.followerCount);
  } catch (e) {
    console.error('✗ Failed scrapeUser:', e.message);
  }

  // Test 2: scrapeTrending
  console.log('\n2. Testing scrapeTrending()...');
  try {
    const trending = await scrapeTrending();
    console.log('✓ Success: Retrieved', trending.length, 'trending items');
    console.log('Sample:', trending.slice(0, 3).map(t => `${t.title} (${t.type})`));
  } catch (e) {
    console.error('✗ Failed scrapeTrending:', e.message);
  }

  // Test 3: scrapeVideo
  console.log('\n3. Testing scrapeVideo("https://www.tiktok.com/@zachking/video/6768504823336815877")...');
  try {
    const video = await scrapeVideo('https://www.tiktok.com/@zachking/video/6768504823336815877');
    console.log('✓ Success:', video.description.slice(0, 50) + '...');
    console.log('Author:', video.author.nickname);
    console.log('Likes:', video.stats.likes, 'Comments count:', video.stats.comments);
    console.log('Video playUrl present:', !!video.video?.playUrl);
    console.log('Music playUrl present:', !!video.music?.playUrl);
  } catch (e) {
    console.error('✗ Failed scrapeVideo:', e.message);
  }

  console.log('\n--- All tests completed ---');
}

runTests();
