/**
 * tiktok-sup
 * Pure TikTok web scraper for Node.js without any 3rd party APIs.
 * Scrapes videos, users, audio, comments & trending data directly from tiktok.com.
 *
 * @author KazeDevID
 * @license MIT
 */

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1';

const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Parses and normalizes any TikTok URL format
 * @param {string} inputUrl
 * @returns {{ videoId?: string, username?: string, isShort: boolean }}
 */
export function parseTikTokUrl(inputUrl) {
  const clean = String(inputUrl || '').trim();
  const isShort = clean.includes('vt.tiktok.com') || clean.includes('vm.tiktok.com') || clean.includes('/t/');
  const videoMatch = clean.match(/\/video\/(\d{15,22})/);
  const photoMatch = clean.match(/\/photo\/(\d{15,22})/);
  const userMatch = clean.match(/@([a-zA-Z0-9_.-]+)/);

  return {
    videoId: videoMatch?.[1] || photoMatch?.[1],
    username: userMatch?.[1],
    isShort,
  };
}

/**
 * Resolves short links (vt.tiktok.com, vm.tiktok.com) to the final canonical URL and returns cookies
 * @param {string} inputUrl
 * @returns {Promise<{ canonicalUrl: string, cookies: string }>}
 */
export async function resolveUrl(inputUrl) {
  let url = String(inputUrl || '').trim();
  if (!url.startsWith('http')) {
    url = 'https://' + url;
  }

  const res = await fetch(url, {
    headers: {
      'User-Agent': MOBILE_USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });

  const cookiesList = (res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')]).filter(Boolean);
  const cookies = cookiesList.map((c) => c.split(';')[0]).join('; ');

  return {
    canonicalUrl: res.url,
    cookies,
  };
}

/**
 * Scrapes a TikTok video or photo post directly from tiktok.com
 * @param {string} inputUrl
 * @returns {Promise<Object>}
 */
export async function scrapeVideo(inputUrl) {
  const { canonicalUrl, cookies: initialCookies } = await resolveUrl(inputUrl);

  const res = await fetch(canonicalUrl, {
    headers: {
      'User-Agent': MOBILE_USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.tiktok.com/',
      ...(initialCookies ? { Cookie: initialCookies } : {}),
    },
  });

  if (!res.ok && res.status !== 200) {
    throw new Error(`Failed to fetch video page from tiktok.com: HTTP ${res.status}`);
  }

  const pageCookiesList = (res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')]).filter(Boolean);
  const pageCookies = pageCookiesList.map((c) => c.split(';')[0]).join('; ');
  const combinedCookies = [initialCookies, pageCookies].filter(Boolean).join('; ');

  const html = await res.text();

  let itemStruct = null;
  let commentsRaw = [];

  // 1. Try parsing from <script id="api-data">
  const apiDataMatch = html.match(/<script id="api-data"[^>]*>([\s\S]*?)<\/script>/);
  if (apiDataMatch) {
    try {
      const parsed = JSON.parse(apiDataMatch[1]);
      if (parsed.videoDetail?.itemInfo?.itemStruct) {
        itemStruct = parsed.videoDetail.itemInfo.itemStruct;
      }
      if (parsed.commentList?.comments && Array.isArray(parsed.commentList.comments)) {
        commentsRaw = parsed.commentList.comments;
      }
    } catch (_) {}
  }

  // 2. Fallback to <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">
  if (!itemStruct) {
    const rehydrationMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    if (rehydrationMatch) {
      try {
        const parsed = JSON.parse(rehydrationMatch[1]);
        const scope = parsed['__DEFAULT_SCOPE__'] || {};
        const videoDetail = scope['webapp.video-detail'];
        if (videoDetail?.itemInfo?.itemStruct) {
          itemStruct = videoDetail.itemInfo.itemStruct;
        }
      } catch (_) {}
    }
  }

  // 3. Fallback to SIGI_STATE
  if (!itemStruct) {
    const sigiMatch = html.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/);
    if (sigiMatch) {
      try {
        const parsed = JSON.parse(sigiMatch[1]);
        const items = parsed.ItemModule || {};
        const firstKey = Object.keys(items)[0];
        if (firstKey && items[firstKey]) {
          itemStruct = items[firstKey];
        }
      } catch (_) {}
    }
  }

  if (!itemStruct) {
    throw new Error('Could not locate TikTok video data on tiktok.com. Video may be private, region-restricted, or deleted.');
  }

  // Parse photos for slideshow posts
  const photos = [];
  if (itemStruct.imagePost?.images && Array.isArray(itemStruct.imagePost.images)) {
    for (const img of itemStruct.imagePost.images) {
      const u = img.displayImage?.urlList?.[0] || img.thumbnail?.urlList?.[0] || img.imageURL?.urlList?.[0];
      if (u) photos.push(u);
    }
  }

  const author = {
    id: String(itemStruct.author?.id || ''),
    username: String(itemStruct.author?.uniqueId || ''),
    nickname: String(itemStruct.author?.nickname || ''),
    avatar: String(itemStruct.author?.avatarLarger || itemStruct.author?.avatarMedium || itemStruct.author?.avatarThumb || ''),
    verified: Boolean(itemStruct.author?.verified),
    secUid: itemStruct.author?.secUid,
    signature: itemStruct.author?.signature,
  };

  const stats = {
    views: Number(itemStruct.stats?.playCount || 0),
    likes: Number(itemStruct.stats?.diggCount || 0),
    comments: Number(itemStruct.stats?.commentCount || 0),
    shares: Number(itemStruct.stats?.shareCount || 0),
    bookmarks: Number(itemStruct.stats?.collectCount || 0),
  };

  let video = undefined;
  if (itemStruct.video) {
    video = {
      id: String(itemStruct.video.id || itemStruct.id || ''),
      duration: Number(itemStruct.video.duration || 0),
      width: Number(itemStruct.video.width || 0),
      height: Number(itemStruct.video.height || 0),
      ratio: itemStruct.video.ratio,
      cover: String(itemStruct.video.cover || ''),
      dynamicCover: itemStruct.video.dynamicCover ? String(itemStruct.video.dynamicCover) : undefined,
      playUrl: itemStruct.video.playAddr ? String(itemStruct.video.playAddr) : undefined,
      downloadUrl: itemStruct.video.downloadAddr ? String(itemStruct.video.downloadAddr) : itemStruct.video.playAddr ? String(itemStruct.video.playAddr) : undefined,
      format: itemStruct.video.format,
    };
  }

  let music = undefined;
  if (itemStruct.music) {
    music = {
      id: String(itemStruct.music.id || ''),
      title: String(itemStruct.music.title || 'Original Sound'),
      author: String(itemStruct.music.authorName || author.nickname),
      duration: Number(itemStruct.music.duration || 0),
      playUrl: itemStruct.music.playUrl ? String(itemStruct.music.playUrl) : undefined,
      cover: itemStruct.music.coverLarge ? String(itemStruct.music.coverLarge) : itemStruct.music.coverMedium ? String(itemStruct.music.coverMedium) : undefined,
    };
  }

  const comments = commentsRaw.map((c) => ({
    cid: String(c.cid || ''),
    text: String(c.text || ''),
    createTime: Number(c.create_time || 0),
    diggCount: Number(c.digg_count || 0),
    replyCount: Number(c.reply_comment_total || 0),
    user: {
      id: String(c.user?.uid || ''),
      username: String(c.user?.unique_id || ''),
      nickname: String(c.user?.nickname || ''),
      avatar: String(c.user?.avatar_thumb?.url_list?.[0] || ''),
    },
  }));

  const createTime = Number(itemStruct.createTime || 0);
  const createDate = createTime > 0 ? new Date(createTime * 1000) : new Date();

  return {
    id: String(itemStruct.id || ''),
    url: canonicalUrl,
    description: String(itemStruct.desc || ''),
    createTime,
    createTimeFormatted: createDate.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    author,
    stats,
    video,
    music,
    isPhoto: photos.length > 0,
    photos: photos.length > 0 ? photos : undefined,
    comments: comments.length > 0 ? comments : undefined,
    sessionCookies: combinedCookies,
  };
}

/**
 * Scrapes a TikTok user profile directly from tiktok.com
 * @param {string} inputUsername
 * @returns {Promise<Object>}
 */
export async function scrapeUser(inputUsername) {
  const username = String(inputUsername || '').trim().replace(/^@+/, '');
  if (!username) {
    throw new Error('Please provide a valid TikTok username (e.g. "khaby.lame" or "@mrbeast").');
  }

  const url = `https://www.tiktok.com/@${encodeURIComponent(username)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': MOBILE_USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch user @${username}: HTTP ${res.status}`);
  }

  const html = await res.text();
  const match = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);

  if (!match) {
    throw new Error(`Could not parse user @${username} data from tiktok.com.`);
  }

  const data = JSON.parse(match[1]);
  const userDetail = data['__DEFAULT_SCOPE__']?.['webapp.user-detail'];
  if (!userDetail?.userInfo?.user) {
    throw new Error(`TikTok user @${username} does not exist or is unavailable.`);
  }

  const u = userDetail.userInfo.user;
  const s = userDetail.userInfo.stats || {};

  return {
    id: String(u.id || ''),
    uniqueId: String(u.uniqueId || username),
    nickname: String(u.nickname || username),
    avatar: String(u.avatarLarger || u.avatarMedium || u.avatarThumb || ''),
    avatarMedium: String(u.avatarMedium || u.avatarThumb || ''),
    avatarThumb: String(u.avatarThumb || ''),
    signature: String(u.signature || ''),
    bioLink: u.bioLink,
    verified: Boolean(u.verified),
    secUid: String(u.secUid || ''),
    privateAccount: Boolean(u.privateAccount),
    stats: {
      followerCount: Number(s.followerCount || 0),
      followingCount: Number(s.followingCount || 0),
      heartCount: Number(s.heartCount || s.heart || 0),
      videoCount: Number(s.videoCount || 0),
      friendCount: Number(s.friendCount || 0),
    },
    shareMeta: userDetail.shareMeta,
  };
}

/**
 * Scrapes trending creators, hashtags, and sound tracks directly from tiktok.com
 * @returns {Promise<Array<Object>>}
 */
export async function scrapeTrending() {
  const res = await fetch('https://www.tiktok.com/node/share/discover', {
    headers: {
      'User-Agent': DESKTOP_USER_AGENT,
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://www.tiktok.com/',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch trending discovery data: HTTP ${res.status}`);
  }

  const json = await res.json();
  const results = [];

  if (Array.isArray(json.body)) {
    for (const group of json.body) {
      if (Array.isArray(group.exploreList)) {
        for (const item of group.exploreList) {
          const card = item.cardItem;
          if (!card) continue;

          let type = 'unknown';
          if (card.type === 2) type = 'creator';
          else if (card.type === 3) type = 'hashtag';
          else if (card.type === 1) type = 'music';

          results.push({
            type,
            id: String(card.id || ''),
            title: String(card.title || ''),
            subTitle: card.subTitle ? String(card.subTitle) : undefined,
            desc: card.desc ? String(card.desc) : undefined,
            cover: card.cover ? String(card.cover) : undefined,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Streams or downloads media buffer directly from TikTok CDN with session cookies
 * @param {string} mediaUrl
 * @param {string} [cookieStr]
 * @returns {Promise<Response>}
 */
export async function fetchMediaStream(mediaUrl, cookieStr = '') {
  return fetch(mediaUrl, {
    headers: {
      'User-Agent': MOBILE_USER_AGENT,
      'Referer': 'https://www.tiktok.com/',
      'Accept': '*/*',
      ...(cookieStr ? { Cookie: cookieStr } : {}),
    },
    redirect: 'follow',
  });
}

export default {
  scrapeVideo,
  scrapeUser,
  scrapeTrending,
  parseTikTokUrl,
  resolveUrl,
  fetchMediaStream,
};
