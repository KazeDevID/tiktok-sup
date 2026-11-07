/**
 * @kazedevid/tiktok-sup v1.2.0
 * Pure TikTok.com Web Scraper Engine
 * Scrapes video (no-watermark MP4), photo carousels/slideshows (HD images),
 * user profiles, audio soundtracks, subtitle closed captions, comments,
 * hashtags, and trending topics directly from tiktok.com.
 *
 * No 3rd-party APIs, no proxies, pure official web parsing.
 *
 * @author KazeDevID
 * @license MIT
 */

import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1';

export const BOT_USER_AGENT =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

export const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Parses and normalizes any TikTok URL, short link, or raw ID
 * @param {string} inputUrl
 */

/**
 * Merges cookie strings and Set-Cookie headers into a single normalized Cookie header string
 * @param {string} [existingCookieStr]
 * @param {string[]|string} [newCookieHeaders]
 * @returns {string}
 */
export function mergeCookies(existingCookieStr = '', newCookieHeaders = []) {
  const jar = new Map();
  if (existingCookieStr) {
    for (const part of String(existingCookieStr).split(';')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        jar.set(trimmed.slice(0, eqIdx).trim(), trimmed.slice(eqIdx + 1).trim());
      }
    }
  }
  const headersList = Array.isArray(newCookieHeaders)
    ? newCookieHeaders
    : newCookieHeaders
    ? [newCookieHeaders]
    : [];
  for (const item of headersList) {
    if (!item) continue;
    const cookiePart = String(item).split(';')[0].trim();
    const eqIdx = cookiePart.indexOf('=');
    if (eqIdx !== -1) {
      jar.set(cookiePart.slice(0, eqIdx).trim(), cookiePart.slice(eqIdx + 1).trim());
    }
  }
  return Array.from(jar.entries())
    .map(([k, v]) => k + '=' + v)
    .join('; ');
}

/**
 * Extracts Set-Cookie strings reliably across different fetch environments
 * @param {Response} res
 * @returns {string[]}
 */
export function extractCookieHeaders(res) {
  if (!res || !res.headers) return [];
  if (typeof res.headers.getSetCookie === 'function') {
    const list = res.headers.getSetCookie();
    if (Array.isArray(list) && list.length > 0) return list.filter(Boolean);
  }
  const raw = res.headers.get('set-cookie');
  return raw ? [raw] : [];
}

export function parseTikTokUrl(inputUrl) {
  const clean = String(inputUrl || '').trim();

  // 1. Raw numeric video/photo ID (e.g. 6768504823336815877)
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

  // Format cleanly if ID is known without username
  if (videoId && !username && !isShort) {
    if (isPhoto) {
      normalizedUrl = `https://www.tiktok.com/@tiktok/photo/${videoId}`;
    } else {
      normalizedUrl = `https://www.tiktok.com/@tiktok/video/${videoId}`;
    }
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
 * Resolves short links (vt.tiktok.com, vm.tiktok.com) and extracts session cookies
 * @param {string} inputUrl
 */
export async function resolveUrl(inputUrl) {
  const { normalizedUrl, videoId: parsedId, isPhoto: parsedIsPhoto } = parseTikTokUrl(inputUrl);

  const res = await fetch(normalizedUrl, {
    headers: {
      'User-Agent': MOBILE_USER_AGENT,
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });

  const cookies = mergeCookies('', extractCookieHeaders(res));

  let finalUrl = res.url;
  const isPhoto = finalUrl.includes('/photo/') || parsedIsPhoto;

  const idMatch = finalUrl.match(/\/video\/(\d{15,22})/);
  const photoMatch = finalUrl.match(/\/photo\/(\d{15,22})/);
  const extractedId = photoMatch?.[1] || idMatch?.[1] || parsedId;

  // If redirected to homepage or short link failed to expand canonical URL, rebuild
  if (finalUrl.includes('tiktok.com/?') && extractedId) {
    finalUrl = isPhoto
      ? `https://www.tiktok.com/@tiktok/photo/${extractedId}`
      : `https://www.tiktok.com/@tiktok/video/${extractedId}`;
  }

  return {
    canonicalUrl: finalUrl,
    cookies,
    videoId: extractedId,
    isPhoto,
  };
}

/**
 * Scrapes a TikTok video or photo post directly from tiktok.com
 * @param {string} inputUrl
 */
export async function scrapeVideo(inputUrl) {
  const { canonicalUrl, cookies: initialCookies, videoId: resolvedId, isPhoto: urlIsPhoto } =
    await resolveUrl(inputUrl);

  // Strategy 1: Fetch mobile reflow page (primary method)
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

  let cookieJar = mergeCookies(initialCookies, extractCookieHeaders(res));

  let html = res.ok ? await res.text() : '';
  let itemStruct = null;
  let commentsRaw = [];

  // Parse Method A: <script id="api-data">
  if (html) {
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
  }

  // Parse Method B: <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">
  if (!itemStruct && html) {
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
  if (!itemStruct && html) {
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

  // Parse Method D: If itemStruct was not in mobile HTML, try with generic @tiktok URL
  if (!itemStruct && resolvedId) {
    try {
      const fallbackUrl = urlIsPhoto
        ? `https://www.tiktok.com/@tiktok/photo/${resolvedId}`
        : `https://www.tiktok.com/@tiktok/video/${resolvedId}`;
      const fbRes = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': MOBILE_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': 'https://www.tiktok.com/',
          ...(cookieJar ? { Cookie: cookieJar } : {}),
        },
        redirect: 'follow',
      });
      // CRITICAL FIX: Merge new session cookies (contains tt_chain_token matching playAddr!)
      cookieJar = mergeCookies(cookieJar, extractCookieHeaders(fbRes));
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

  // Strategy 2: Googlebot Fallback Engine for VideoObject Schema.org
  let videoObjectData = null;
  if (!itemStruct && resolvedId) {
    try {
      const botUrl = `https://www.tiktok.com/@tiktok/video/${resolvedId}`;
      const botRes = await fetch(botUrl, {
        headers: {
          'User-Agent': BOT_USER_AGENT,
          'Referer': 'https://www.tiktok.com/',
          ...(cookieJar ? { Cookie: cookieJar } : {}),
        },
        redirect: 'follow',
      });
      cookieJar = mergeCookies(cookieJar, extractCookieHeaders(botRes));
      if (botRes.ok) {
        const botHtml = await botRes.text();
        const voMatch = botHtml.match(/<script[^>]*id="VideoObject"[^>]*>([\s\S]*?)<\/script>/);
        if (voMatch) {
          videoObjectData = JSON.parse(voMatch[1]);
        }
      }
    } catch (_) {}
  }

  if (!itemStruct && !videoObjectData) {
    throw new Error(
      'Could not locate TikTok post data on tiktok.com. Post may be private, region-restricted, or removed.'
    );
  }

  // 1. Check for Photo Post (Slideshow / Carousel)
  const photoDetails = [];
  const photos = [];

  const rawImages =
    itemStruct?.imagePost?.images ||
    itemStruct?.images ||
    [];

  if (Array.isArray(rawImages) && rawImages.length > 0) {
    rawImages.forEach((img, idx) => {
      const urlList =
        img.imageURL?.urlList ||
        img.displayImage?.urlList ||
        img.thumbnail?.urlList ||
        (img.url ? [img.url] : []);

      const primaryUrl = urlList[0];
      if (primaryUrl) {
        photos.push(primaryUrl);
        photoDetails.push({
          index: idx + 1,
          url: primaryUrl,
          backupUrls: urlList.slice(1),
          thumbnail: img.thumbnail?.urlList?.[0] || primaryUrl,
          width: Number(img.imageWidth || img.width || 0) || undefined,
          height: Number(img.imageHeight || img.height || 0) || undefined,
        });
      }
    });
  }

  const isPhoto = photos.length > 0;
  const postType = isPhoto ? 'photo' : 'video';

  // 2. Author details
  const author = {
    id: String(itemStruct?.author?.id || videoObjectData?.creator?.['@id'] || ''),
    username: String(itemStruct?.author?.uniqueId || videoObjectData?.creator?.name || ''),
    nickname: String(itemStruct?.author?.nickname || videoObjectData?.creator?.name || 'TikTok Creator'),
    avatar: String(
      itemStruct?.author?.avatarLarger ||
        itemStruct?.author?.avatarMedium ||
        itemStruct?.author?.avatarThumb ||
        ''
    ),
    verified: Boolean(itemStruct?.author?.verified),
    secUid: itemStruct?.author?.secUid,
    signature: itemStruct?.author?.signature,
  };

  // 3. Statistics
  let interactionLikes = 0;
  let interactionComments = 0;
  if (Array.isArray(videoObjectData?.interactionStatistic)) {
    for (const st of videoObjectData.interactionStatistic) {
      const type = st.interactionType?.['@type'] || '';
      if (type.includes('LikeAction')) interactionLikes = Number(st.userInteractionCount || 0);
      if (type.includes('CommentAction')) interactionComments = Number(st.userInteractionCount || 0);
    }
  }

  const stats = {
    views: Number(itemStruct?.stats?.playCount || 0),
    likes: Number(itemStruct?.stats?.diggCount || interactionLikes || 0),
    comments: Number(itemStruct?.stats?.commentCount || interactionComments || 0),
    shares: Number(itemStruct?.stats?.shareCount || 0),
    bookmarks: Number(itemStruct?.stats?.collectCount || 0),
  };

  // 4. Bitrates list
  const bitrates = [];
  if (Array.isArray(itemStruct?.video?.bitrateInfo)) {
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

  // 5. Subtitles / Closed Captions
  const subtitles = [];
  if (Array.isArray(itemStruct?.video?.subtitleInfos)) {
    for (const sub of itemStruct.video.subtitleInfos) {
      if (sub.Url) {
        subtitles.push({
          id: String(sub.Id || ''),
          language: String(sub.Language || ''),
          languageCode: String(sub.LanguageCodeName || ''),
          url: String(sub.Url),
          format: String(sub.Format || 'webvtt'),
          source: String(sub.Source || ''),
        });
      }
    }
  }

  // 6. Video Media (only populated if postType === 'video')
  let video;
  if (!isPhoto) {
    const playAddr = itemStruct?.video?.playAddr
      ? String(itemStruct.video.playAddr)
      : bitrates[0]?.url;
    const downloadAddr = itemStruct?.video?.downloadAddr
      ? String(itemStruct.video.downloadAddr)
      : playAddr;

    const signedApiUrl = videoObjectData?.contentUrl;
    const resolvedPlayUrl = playAddr || signedApiUrl;

    if (resolvedPlayUrl || itemStruct?.video) {
      video = {
        id: String(itemStruct?.video?.id || itemStruct?.id || resolvedId || ''),
        duration: Number(itemStruct?.video?.duration || 0),
        width: Number(itemStruct?.video?.width || 0),
        height: Number(itemStruct?.video?.height || 0),
        ratio: itemStruct?.video?.ratio,
        cover: String(
          itemStruct?.video?.cover ||
            (Array.isArray(videoObjectData?.thumbnailUrl)
              ? videoObjectData.thumbnailUrl[0]
              : videoObjectData?.thumbnailUrl) ||
            ''
        ),
        dynamicCover: itemStruct?.video?.dynamicCover
          ? String(itemStruct.video.dynamicCover)
          : undefined,
        originCover: itemStruct?.video?.originCover
          ? String(itemStruct.video.originCover)
          : undefined,
        playUrl: resolvedPlayUrl,
        noWatermarkUrl: resolvedPlayUrl, // High-quality stream without watermark
        downloadUrl: downloadAddr || resolvedPlayUrl,
        watermarkUrl: downloadAddr || resolvedPlayUrl,
        signedApiUrl,
        bitrates: bitrates.length > 0 ? bitrates : undefined,
        subtitles: subtitles.length > 0 ? subtitles : undefined,
        format: itemStruct?.video?.format || 'mp4',
      };
    }
  }

  // 7. Music soundtrack
  let music;
  if (itemStruct?.music) {
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

  // 8. Comments
  let comments;
  if (commentsRaw.length > 0) {
    comments = commentsRaw.map((c) => ({
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
  } else if (Array.isArray(videoObjectData?.comment)) {
    comments = videoObjectData.comment.map((c, i) => ({
      cid: String(i + 1),
      text: String(c.text || ''),
      createTime: c.datePublished ? Math.floor(new Date(c.datePublished).getTime() / 1000) : 0,
      diggCount: Number(c.interactionStatistic?.userInteractionCount || 0),
      replyCount: 0,
      user: {
        id: String(c.author?.url?.split('@')[1] || ''),
        username: String(c.author?.alternateName || ''),
        nickname: String(c.author?.name || ''),
        avatar: '',
      },
    }));
  }

  const createTime = Number(
    itemStruct?.createTime ||
      (videoObjectData?.uploadDate
        ? Math.floor(new Date(videoObjectData.uploadDate).getTime() / 1000)
        : 0)
  );
  const createDate = createTime > 0 ? new Date(createTime * 1000) : new Date();

  const description = String(
    itemStruct?.desc || videoObjectData?.description || ''
  );

  const result = {
    id: String(itemStruct?.id || resolvedId || ''),
    url: canonicalUrl,
    postType,
    isPhoto,
    description,
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
    photos: isPhoto ? photos : undefined,
    photoDetails: isPhoto ? photoDetails : undefined,
    music,
    comments,
    sessionCookies: cookieJar,
  };
  // Direct download helpers bound to current verified session cookies
  if (result.video) {
    const defaultMediaUrl = result.video.noWatermarkUrl || result.video.playUrl;
    result.download = (outputPath) =>
      downloadFile(defaultMediaUrl, outputPath, cookieJar);
    result.downloadBuffer = () =>
      downloadBuffer(defaultMediaUrl, cookieJar);
  }
  if (result.isPhoto && result.photos) {
    result.downloadPhotos = (outputDir) =>
      downloadAllPhotos(result.photos, outputDir, cookieJar);
  }
  return result;
}

/**
 * Scrapes a TikTok user profile directly from tiktok.com
 * @param {string} inputUsername
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
 */
export async function scrapeTrending(category) {
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
 * Scrapes a specific hashtag/challenge from discover list or tag page
 * @param {string} tag
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
 */
export async function scrapeSound(soundIdOrUrl) {
  const clean = String(soundIdOrUrl || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?tiktok\.com\/music\/[^\/]+-/, '');
  const trending = await scrapeTrending('music');
  const matched = trending.find((m) => m.id === clean || m.title.toLowerCase().includes(clean.toLowerCase()));

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
 * Streams media buffer directly from TikTok CDN with session cookies and referer headers
 * @param {string} mediaUrl
 * @param {string} [cookieStr]
 * @param {string} [rangeHeader]
 * @param {string} [userAgent]
 */
export async function fetchMediaStream(
  mediaUrl,
  cookieStr = '',
  rangeHeader,
  userAgent = MOBILE_USER_AGENT
) {
  const headers = {
    'User-Agent': userAgent,
    'Referer': 'https://www.tiktok.com/',
    'Accept': '*/*',
  };

  if (cookieStr) {
    headers['Cookie'] = cookieStr;
  }
  if (rangeHeader) {
    headers['Range'] = rangeHeader;
  }

  let res = await fetch(mediaUrl, {
    headers,
    redirect: 'follow',
  });

  // Intelligent fallback: TikTok CDN (Akamai) frequently demands Range: bytes=0- on stream requests
  if (res.status === 403 && !rangeHeader) {
    headers['Range'] = 'bytes=0-';
    const retryRes = await fetch(mediaUrl, {
      headers,
      redirect: 'follow',
    });
    if (retryRes.ok) {
      return retryRes;
    }
  }

  return res;
}

/**
 * Downloads a video, audio, or photo file directly to local disk with session cookies
 * @param {string} mediaUrl
 * @param {string} outputPath
 * @param {string} [cookieStr]
 */
export async function downloadFile(mediaUrl, outputPath, cookieStr = '') {
  if (!mediaUrl) throw new Error('Parameter "mediaUrl" is required');
  if (!outputPath) throw new Error('Parameter "outputPath" is required');

  const res = await fetchMediaStream(mediaUrl, cookieStr);
  if (!res.ok) {
    throw new Error(
      `Failed to download media: HTTP ${res.status} (${res.statusText || 'Forbidden'}). ` +
      `Ensure you pass the matching sessionCookies: await downloadFile(cleanUrl, path, post.sessionCookies) or use post.download(path).`
    );
  }

  const dir = path.dirname(path.resolve(outputPath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const fileStream = fs.createWriteStream(outputPath);
  if (res.body) {
    await pipeline(Readable.fromWeb(res.body), fileStream);
  } else {
    throw new Error('Response body was empty');
  }

  return outputPath;
}

/**
 * Downloads media into an in-memory Node Buffer (useful for bots and cloud storage)
 * @param {string} mediaUrl
 * @param {string} [cookieStr]
 * @returns {Promise<Buffer>}
 */
export async function downloadBuffer(mediaUrl, cookieStr = '') {
  if (!mediaUrl) throw new Error('Parameter "mediaUrl" is required');

  const res = await fetchMediaStream(mediaUrl, cookieStr);
  if (!res.ok) {
    throw new Error(`Failed to download media buffer: HTTP ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Downloads a single photo from a slideshow
 * @param {string} photoUrl
 * @param {string} outputPath
 * @param {string} [cookieStr]
 */
export async function downloadPhoto(photoUrl, outputPath, cookieStr = '') {
  return downloadFile(photoUrl, outputPath, cookieStr);
}

/**
 * Downloads all photos from a TikTok photo carousel/slideshow to a target directory
 * @param {string[]} photoUrls Array of photo URLs
 * @param {string} outputDir Target directory path
 * @param {string} [cookieStr]
 * @returns {Promise<string[]>} Array of saved file paths
 */
export async function downloadAllPhotos(photoUrls, outputDir, cookieStr = '') {
  if (!Array.isArray(photoUrls) || photoUrls.length === 0) {
    throw new Error('Parameter "photoUrls" must be a non-empty array');
  }

  const resolvedDir = path.resolve(outputDir || './photos');
  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
  }

  const savedPaths = [];
  for (let i = 0; i < photoUrls.length; i++) {
    const filename = `photo_${String(i + 1).padStart(2, '0')}.jpg`;
    const targetPath = path.join(resolvedDir, filename);
    await downloadFile(photoUrls[i], targetPath, cookieStr);
    savedPaths.push(targetPath);
  }

  return savedPaths;
}

export default {
  scrapeVideo,
  scrapeUser,
  scrapeTrending,
  scrapeHashtag,
  scrapeSound,
  downloadFile,
  downloadBuffer,
  downloadPhoto,
  downloadAllPhotos,
  parseTikTokUrl,
  resolveUrl,
  fetchMediaStream,
};
