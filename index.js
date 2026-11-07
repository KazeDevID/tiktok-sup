/**
 * @kazedevid/tiktok-sup (v1.1.0)
 * Pure TikTok web scraper for Node.js without any 3rd party APIs.
 * Scrapes videos (no-watermark), users, audio, comments, hashtags & trending data directly from tiktok.com.
 *
 * @author KazeDevID
 * @license MIT
 */

import fs from 'fs';
import path from 'path';

export const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1';

export const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Parses and normalizes any TikTok URL or ID format
 * @param {string} inputUrl
 * @returns {{ videoId?: string, username?: string, isShort: boolean, isPhoto: boolean, normalizedUrl: string }}
 */
export function parseTikTokUrl(inputUrl) {
  const clean = String(inputUrl || '').trim();

  // 1. Raw numeric video ID (e.g. 6768504823336815877)
  if (/^\d{15,22}$/.test(clean)) {
    return {
      videoId: clean,
      isShort: false,
      isPhoto: false,
      normalizedUrl: `https://www.tiktok.com/@tiktok/video/${clean}`,
    };
  }

  const isShort =
    clean.includes('vt.tiktok.com') ||
    clean.includes('vm.tiktok.com') ||
    clean.includes('/t/');
  const isPhoto = clean.includes('/photo/');

  const videoMatch = clean.match(/\/video\/(\d{15,22})/);
  const photoMatch = clean.match(/\/photo\/(\d{15,22})/);
  const vMatch = clean.match(/\/v\/(\d{15,22})/);
  const userMatch = clean.match(/@([a-zA-Z0-9_.-]+)/);

  const videoId = videoMatch?.[1] || photoMatch?.[1] || vMatch?.[1];
  const username = userMatch?.[1];

  let normalizedUrl = clean;
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    normalizedUrl = 'https://' + clean;
  }

  if (videoId && !username && !isShort) {
    normalizedUrl = `https://www.tiktok.com/@tiktok/video/${videoId}`;
  }

  return {
    videoId,
    username,
    isShort,
    isPhoto,
    normalizedUrl,
  };
}

/**
 * Resolves short links (vt.tiktok.com, vm.tiktok.com) and returns canonical URL and cookies
 * @param {string} inputUrl
 * @returns {Promise<{ canonicalUrl: string, cookies: string, videoId?: string }>}
 */
export async function resolveUrl(inputUrl) {
  const { normalizedUrl, videoId: parsedId } = parseTikTokUrl(inputUrl);

  const res = await fetch(normalizedUrl, {
    headers: {
      'User-Agent': MOBILE_USER_AGENT,
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });

  const cookiesList = (
    res.headers.getSetCookie
      ? res.headers.getSetCookie()
      : [res.headers.get('set-cookie')]
  ).filter(Boolean);
  const cookies = cookiesList.map((c) => c.split(';')[0]).join('; ');

  let finalUrl = res.url;
  const idMatch = finalUrl.match(/\/video\/(\d{15,22})/);
  const photoMatch = finalUrl.match(/\/photo\/(\d{15,22})/);
  const extractedId = idMatch?.[1] || photoMatch?.[1] || parsedId;

  if (finalUrl.includes('tiktok.com/?') && extractedId) {
    finalUrl = `https://www.tiktok.com/@tiktok/video/${extractedId}`;
  }

  return {
    canonicalUrl: finalUrl,
    cookies,
    videoId: extractedId,
  };
}

/**
 * Scrapes a TikTok video or photo post directly from tiktok.com
 * @param {string} inputUrl
 * @returns {Promise<Object>}
 */
export async function scrapeVideo(inputUrl) {
  const { canonicalUrl, cookies: initialCookies, videoId: resolvedId } =
    await resolveUrl(inputUrl);

  const res = await fetch(canonicalUrl, {
    headers: {
      'User-Agent': MOBILE_USER_AGENT,
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.tiktok.com/',
      ...(initialCookies ? { Cookie: initialCookies } : {}),
    },
    redirect: 'follow',
  });

  if (!res.ok && res.status !== 200) {
    throw new Error(
      `Failed to fetch video page from tiktok.com: HTTP ${res.status}`
    );
  }

  const pageCookiesList = (
    res.headers.getSetCookie
      ? res.headers.getSetCookie()
      : [res.headers.get('set-cookie')]
  ).filter(Boolean);
  const pageCookies = pageCookiesList.map((c) => c.split(';')[0]).join('; ');
  const combinedCookies = [initialCookies, pageCookies]
    .filter(Boolean)
    .join('; ');

  const html = await res.text();

  let itemStruct = null;
  let commentsRaw = [];

  // Parse Method A: <script id="api-data">
  const apiDataMatch = html.match(
    /<script id="api-data"[^>]*>([\s\S]*?)<\/script>/
  );
  if (apiDataMatch) {
    try {
      const parsed = JSON.parse(apiDataMatch[1]);
      if (parsed.videoDetail?.itemInfo?.itemStruct) {
        itemStruct = parsed.videoDetail.itemInfo.itemStruct;
      }
      if (
        parsed.commentList?.comments &&
        Array.isArray(parsed.commentList.comments)
      ) {
        commentsRaw = parsed.commentList.comments;
      }
    } catch (_) {}
  }

  // Parse Method B: <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">
  if (!itemStruct) {
    const rehydrationMatch = html.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
    );
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

  // Parse Method C: SIGI_STATE
  if (!itemStruct) {
    const sigiMatch = html.match(
      /<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/
    );
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

  // Parse Method D: Fallback with generic handle
  if (!itemStruct && resolvedId) {
    try {
      const fallbackUrl = `https://www.tiktok.com/@tiktok/video/${resolvedId}`;
      const fbRes = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': MOBILE_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': 'https://www.tiktok.com/',
        },
        redirect: 'follow',
      });
      if (fbRes.ok) {
        const fbHtml = await fbRes.text();
        const fbApiMatch = fbHtml.match(/<script id="api-data"[^>]*>([\s\S]*?)<\/script>/);
        if (fbApiMatch) {
          const parsed = JSON.parse(fbApiMatch[1]);
          if (parsed.videoDetail?.itemInfo?.itemStruct) {
            itemStruct = parsed.videoDetail.itemInfo.itemStruct;
          }
          if (parsed.commentList?.comments) {
            commentsRaw = parsed.commentList.comments;
          }
        }
      }
    } catch (_) {}
  }

  if (!itemStruct) {
    throw new Error(
      'Could not locate TikTok video data on tiktok.com. Video may be private, region-restricted, or removed.'
    );
  }

  // Photos
  const photos = [];
  if (
    itemStruct.imagePost?.images &&
    Array.isArray(itemStruct.imagePost.images)
  ) {
    for (const img of itemStruct.imagePost.images) {
      const u =
        img.displayImage?.urlList?.[0] ||
        img.thumbnail?.urlList?.[0] ||
        img.imageURL?.urlList?.[0];
      if (u) photos.push(u);
    }
  }

  const author = {
    id: String(itemStruct.author?.id || ''),
    username: String(itemStruct.author?.uniqueId || ''),
    nickname: String(itemStruct.author?.nickname || ''),
    avatar: String(
      itemStruct.author?.avatarLarger ||
        itemStruct.author?.avatarMedium ||
        itemStruct.author?.avatarThumb ||
        ''
    ),
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

  const bitrates = [];
  if (Array.isArray(itemStruct.video?.bitrateInfo)) {
    for (const b of itemStruct.video.bitrateInfo) {
      bitrates.push({
        gearName: b.GearName,
        bitrate: b.Bitrate,
        qualityType: b.QualityType,
        codecType: b.CodecType,
        url: b.PlayAddr?.UrlList?.[0],
      });
    }
  }

  let video = undefined;
  if (itemStruct.video) {
    const playAddr = itemStruct.video.playAddr
      ? String(itemStruct.video.playAddr)
      : undefined;
    const downloadAddr = itemStruct.video.downloadAddr
      ? String(itemStruct.video.downloadAddr)
      : playAddr;

    video = {
      id: String(itemStruct.video.id || itemStruct.id || ''),
      duration: Number(itemStruct.video.duration || 0),
      width: Number(itemStruct.video.width || 0),
      height: Number(itemStruct.video.height || 0),
      ratio: itemStruct.video.ratio,
      cover: String(itemStruct.video.cover || ''),
      dynamicCover: itemStruct.video.dynamicCover
        ? String(itemStruct.video.dynamicCover)
        : undefined,
      playUrl: playAddr,
      noWatermarkUrl: playAddr, // Direct high-quality clean stream
      downloadUrl: downloadAddr,
      watermarkUrl: downloadAddr,
      bitrates: bitrates.length > 0 ? bitrates : undefined,
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
      playUrl: itemStruct.music.playUrl
        ? String(itemStruct.music.playUrl)
        : undefined,
      cover: itemStruct.music.coverLarge
        ? String(itemStruct.music.coverLarge)
        : itemStruct.music.coverMedium
        ? String(itemStruct.music.coverMedium)
        : undefined,
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
    id: String(itemStruct.id || resolvedId || ''),
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
  const clean = String(inputUsername || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, '')
    .replace(/^@+/, '')
    .split('/')[0]
    .split('?')[0];

  if (!clean) {
    throw new Error(
      'Please provide a valid TikTok username (e.g. "khaby.lame" or "@mrbeast").'
    );
  }

  const url = `https://www.tiktok.com/@${encodeURIComponent(clean)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': MOBILE_USER_AGENT,
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch user @${clean}: HTTP ${res.status}`);
  }

  const html = await res.text();
  const match = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
  );

  if (!match) {
    throw new Error(
      `Could not parse user @${clean} data from tiktok.com.`
    );
  }

  const data = JSON.parse(match[1]);
  const userDetail = data['__DEFAULT_SCOPE__']?.['webapp.user-detail'];
  if (!userDetail?.userInfo?.user) {
    throw new Error(
      `TikTok user @${clean} does not exist or is unavailable.`
    );
  }

  const u = userDetail.userInfo.user;
  const s = userDetail.userInfo.stats || {};

  return {
    id: String(u.id || ''),
    uniqueId: String(u.uniqueId || clean),
    nickname: String(u.nickname || clean),
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
 * @param {'all' | 'creator' | 'hashtag' | 'music'} [category]
 * @returns {Promise<Array<Object>>}
 */
export async function scrapeTrending(category = 'all') {
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

          if (category && category !== 'all' && type !== category) {
            continue;
          }

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
 * Scrapes hashtag info
 * @param {string} tag
 * @returns {Promise<Object>}
 */
export async function scrapeHashtag(tag) {
  const cleanTag = String(tag || '').trim().replace(/^#+/, '');
  const trending = await scrapeTrending('hashtag');
  const matched = trending.find(
    (t) => t.title.toLowerCase().replace(/^#+/, '') === cleanTag.toLowerCase()
  );

  if (matched) {
    return {
      id: matched.id,
      title: matched.title,
      views: matched.subTitle,
      desc: matched.desc,
      cover: matched.cover,
    };
  }

  return {
    id: cleanTag,
    title: `#${cleanTag}`,
    views: 'Trending',
  };
}

/**
 * Scrapes sound track details
 * @param {string} soundIdOrUrl
 * @returns {Promise<Object>}
 */
export async function scrapeSound(soundIdOrUrl) {
  const clean = String(soundIdOrUrl || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?tiktok\.com\/music\/[^\/]+-/, '');
  const trending = await scrapeTrending('music');
  const matched = trending.find(
    (m) =>
      m.id === clean ||
      m.title.toLowerCase().includes(clean.toLowerCase())
  );

  if (matched) {
    return {
      id: matched.id,
      title: matched.title,
      author: matched.subTitle,
      cover: matched.cover,
    };
  }

  return {
    id: clean,
    title: 'Soundtrack',
  };
}

/**
 * Streams media buffer directly from TikTok CDN with session cookies
 * @param {string} mediaUrl
 * @param {string} [cookieStr]
 * @param {string} [rangeHeader]
 * @returns {Promise<Response>}
 */
export async function fetchMediaStream(mediaUrl, cookieStr = '', rangeHeader) {
  const headers = {
    'User-Agent': MOBILE_USER_AGENT,
    'Referer': 'https://www.tiktok.com/',
    'Accept': '*/*',
  };

  if (cookieStr) headers['Cookie'] = cookieStr;
  if (rangeHeader) headers['Range'] = rangeHeader;

  return fetch(mediaUrl, {
    headers,
    redirect: 'follow',
  });
}

/**
 * Downloads media and returns a Node.js Buffer
 * @param {string} mediaUrl
 * @param {string} [cookieStr]
 * @returns {Promise<Buffer>}
 */
export async function downloadBuffer(mediaUrl, cookieStr = '') {
  const res = await fetchMediaStream(mediaUrl, cookieStr);
  if (!res.ok && res.status !== 206) {
    throw new Error(`Media download failed with status ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Downloads media directly to a local file
 * @param {string} mediaUrl
 * @param {string} outputPath
 * @param {string} [cookieStr]
 * @returns {Promise<string>}
 */
export async function downloadFile(mediaUrl, outputPath, cookieStr = '') {
  const buf = await downloadBuffer(mediaUrl, cookieStr);
  const resolved = path.resolve(outputPath);
  fs.writeFileSync(resolved, buf);
  return resolved;
}

export default {
  scrapeVideo,
  scrapeUser,
  scrapeTrending,
  scrapeHashtag,
  scrapeSound,
  parseTikTokUrl,
  resolveUrl,
  fetchMediaStream,
  downloadBuffer,
  downloadFile,
};
