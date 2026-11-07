/**
 * @license
 * MIT License
 * Copyright (c) 2026 KazeDevID
 *
 * @kazedevid/tiktok-sup v1.3.0
 * Pure TikTok Web Scraper & Clean Media Stream Engine
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

export type TikTokPostType = 'video' | 'photo';

export interface DownloadOptions {
  quality?: 'highest' | 'lowest' | 'original' | '1080p' | '720p' | '540p' | string;
}

export interface BatchItemResult {
  url: string;
  success: boolean;
  id?: string;
  postType?: 'video' | 'photo';
  path?: string;
  count?: number;
  error?: string;
}

export interface BatchDownloadOptions extends DownloadOptions {
  onProgress?: (progress: {
    current: number;
    total: number;
    item?: BatchItemResult;
    error?: string;
  }) => void;
  delayMs?: number;
}

export interface TikTokAuthor {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  verified: boolean;
  secUid?: string;
  signature?: string;
}

export interface TikTokStats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  bookmarks: number;
}

export interface TikTokBitrate {
  gearName?: string;
  bitrate?: number;
  qualityType?: number;
  codecType?: string;
  url?: string;
}

export interface TikTokSubtitle {
  id?: string;
  language: string;
  languageCode: string;
  url: string;
  format?: string;
  source?: string;
}

export interface TikTokVideoMedia {
  id: string;
  duration: number;
  width: number;
  height: number;
  ratio?: string;
  cover: string;
  dynamicCover?: string;
  originCover?: string;
  playUrl?: string;
  noWatermarkUrl?: string;
  downloadUrl?: string;
  watermarkUrl?: string;
  signedApiUrl?: string;
  bitrates?: TikTokBitrate[];
  subtitles?: TikTokSubtitle[];
  format?: string;
}

export interface TikTokPhotoItem {
  index: number;
  url: string;
  backupUrls?: string[];
  thumbnail?: string;
  width?: number;
  height?: number;
}

export interface TikTokMusic {
  id: string;
  title: string;
  author: string;
  duration: number;
  playUrl?: string;
  cover?: string;
}

export interface TikTokComment {
  cid: string;
  text: string;
  createTime: number;
  diggCount: number;
  replyCount: number;
  user: {
    id: string;
    username: string;
    nickname: string;
    avatar: string;
  };
}

export interface TikTokVideoResult {
  id: string;
  url: string;
  postType: TikTokPostType;
  isPhoto: boolean;
  description: string;
  createTime: number;
  createTimeFormatted: string;
  author: TikTokAuthor;
  stats: TikTokStats;
  video?: TikTokVideoMedia;
  photos?: string[];
  photoDetails?: TikTokPhotoItem[];
  music?: TikTokMusic;
  comments?: TikTokComment[];
  sessionCookies: string;
  download?: (outputPath: string, options?: DownloadOptions) => Promise<string>;
  downloadBuffer?: () => Promise<Buffer>;
  downloadPhotos?: (outputDir: string) => Promise<string[]>;
  downloadAudio?: (outputPath: string) => Promise<string>;
  downloadAudioBuffer?: () => Promise<Buffer>;
}

export interface TikTokUserProfile {
  id: string;
  uniqueId: string;
  nickname: string;
  avatar: string;
  avatarMedium: string;
  avatarThumb: string;
  signature: string;
  bioLink?: { link: string; risk: number };
  verified: boolean;
  secUid: string;
  privateAccount: boolean;
  stats: {
    followerCount: number;
    followingCount: number;
    heartCount: number;
    videoCount: number;
    friendCount: number;
  };
  shareMeta?: {
    title: string;
    desc: string;
  };
}

export interface TikTokTrendingItem {
  type: 'creator' | 'hashtag' | 'music' | 'unknown';
  id: string;
  title: string;
  subTitle?: string;
  desc?: string;
  cover?: string;
}

export interface TikTokHashtagInfo {
  id: string;
  title: string;
  views?: string;
  desc?: string;
  cover?: string;
}

export interface TikTokSoundInfo {
  id: string;
  title: string;
  author?: string;
  playUrl?: string;
  cover?: string;
  duration?: number;
}

/**
 * Merges cookie strings and Set-Cookie headers into a single normalized Cookie header string
 */
export function mergeCookies(
  existingCookieStr = '',
  newCookieHeaders: string | string[] = []
): string {
  const jar = new Map<string, string>();
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
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/**
 * Extracts Set-Cookie strings reliably across different fetch environments
 */
export function extractCookieHeaders(res: Response): string[] {
  if (!res || !res.headers) return [];
  const headersAny = res.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof headersAny.getSetCookie === 'function') {
    const list = headersAny.getSetCookie();
    if (Array.isArray(list) && list.length > 0) return list.filter(Boolean);
  }
  const raw = res.headers.get('set-cookie');
  return raw ? [raw] : [];
}

/**
 * Recursively locates itemStruct in any TikTok JSON payload (handles mobile reflow, desktop, and schema changes)
 */
export function findItemStruct(obj: any, depth = 0): any {
  if (!obj || typeof obj !== 'object' || depth > 8) return null;
  if (obj.itemInfo?.itemStruct && typeof obj.itemInfo.itemStruct === 'object') {
    return obj.itemInfo.itemStruct;
  }
  if (
    obj.itemStruct &&
    typeof obj.itemStruct === 'object' &&
    (obj.itemStruct.id || obj.itemStruct.imagePost || obj.itemStruct.video)
  ) {
    return obj.itemStruct;
  }
  for (const key of Object.keys(obj)) {
    if (key.includes('translation') || key.includes('i18n')) continue;
    const val = obj[key];
    if (val && typeof val === 'object') {
      const found = findItemStruct(val, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Parses and normalizes any TikTok URL, short link, or raw ID
 */
export function parseTikTokUrl(inputUrl: string): {
  videoId?: string;
  username?: string;
  isShort: boolean;
  isPhoto: boolean;
  normalizedUrl: string;
} {
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
 */
export async function resolveUrl(inputUrl: string): Promise<{
  canonicalUrl: string;
  cookies: string;
  videoId?: string;
  isPhoto: boolean;
}> {
  const { normalizedUrl, videoId: parsedId, isPhoto: parsedIsPhoto } =
    parseTikTokUrl(inputUrl);

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
 */
export async function scrapeVideo(inputUrl: string): Promise<TikTokVideoResult> {
  const {
    canonicalUrl,
    cookies: initialCookies,
    videoId: resolvedId,
    isPhoto: urlIsPhoto,
  } = await resolveUrl(inputUrl);

  let cookieJar = initialCookies || '';

  // Strategy 1: Fetch mobile reflow page (primary method)
  const res = await fetch(canonicalUrl, {
    headers: {
      'User-Agent': MOBILE_USER_AGENT,
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.tiktok.com/',
      ...(cookieJar ? { Cookie: cookieJar } : {}),
    },
    redirect: 'follow',
  });

  cookieJar = mergeCookies(cookieJar, extractCookieHeaders(res));

  let html = res.ok ? await res.text() : '';
  let itemStruct: any = null;
  let commentsRaw: any[] = [];

  // Parse Method A: <script id="api-data">
  if (html) {
    const apiDataMatch = html.match(
      /<script id="api-data"[^>]*>([\s\S]*?)<\/script>/
    );
    if (apiDataMatch) {
      try {
        const parsed = JSON.parse(apiDataMatch[1]);
        const detail =
          parsed.videoDetail ||
          parsed.reflowVideoDetail ||
          parsed.photoDetail;
        if (detail?.itemInfo?.itemStruct) {
          itemStruct = detail.itemInfo.itemStruct;
        } else {
          itemStruct = findItemStruct(parsed);
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
        const detailObj =
          scope['webapp.reflow.video.detail'] ||
          scope['webapp.video-detail'] ||
          scope['webapp.reflow.photo.detail'] ||
          scope['webapp.photo-detail'] ||
          scope['webapp.videoDetail'];

        if (detailObj?.itemInfo?.itemStruct) {
          itemStruct = detailObj.itemInfo.itemStruct;
        } else {
          itemStruct = findItemStruct(parsed);
        }
        if (detailObj?.commentList?.comments && Array.isArray(detailObj.commentList.comments)) {
          commentsRaw = detailObj.commentList.comments;
        }
      } catch (_) {}
    }
  }

  // Parse Method B.2: <script id="__NEXT_DATA__">
  if (!itemStruct && html) {
    const nextMatch = html.match(
      /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
    );
    if (nextMatch) {
      try {
        const parsed = JSON.parse(nextMatch[1]);
        itemStruct = findItemStruct(parsed);
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

  // Parse Method D: If itemStruct or video.playAddr missing, try with generic @tiktok URL
  const needsPlayAddr = !itemStruct || (!itemStruct.imagePost && !itemStruct.video?.playAddr);
  if (needsPlayAddr && resolvedId) {
    try {
      const fallbackUrl = urlIsPhoto
        ? `https://www.tiktok.com/@tiktok/photo/${resolvedId}`
        : `https://www.tiktok.com/@tiktok/video/${resolvedId}`;
      const fbRes = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': MOBILE_USER_AGENT,
          'Accept':
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': 'https://www.tiktok.com/',
          ...(cookieJar ? { Cookie: cookieJar } : {}),
        },
        redirect: 'follow',
      });
      // CRITICAL FIX: Merge new session cookies (contains tt_chain_token matching playAddr!)
      cookieJar = mergeCookies(cookieJar, extractCookieHeaders(fbRes));

      if (fbRes.ok) {
        const fbHtml = await fbRes.text();
        const fbApiMatch = fbHtml.match(
          /<script id="api-data"[^>]*>([\s\S]*?)<\/script>/
        );
        if (fbApiMatch) {
          const parsed = JSON.parse(fbApiMatch[1]);
          const d = parsed.videoDetail || parsed.photoDetail;
          if (d?.itemInfo?.itemStruct) {
            itemStruct = d.itemInfo.itemStruct;
          } else {
            itemStruct = findItemStruct(parsed);
          }
          if (parsed.commentList?.comments) {
            commentsRaw = parsed.commentList.comments;
          }
        }
      }
    } catch (_) {}
  }

  // Strategy 2: Googlebot Fallback Engine for VideoObject Schema.org
  let videoObjectData: any = null;
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
        const voMatch = botHtml.match(
          /<script[^>]*id="VideoObject"[^>]*>([\s\S]*?)<\/script>/
        );
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

  // 1. Photos
  const photoDetails: TikTokPhotoItem[] = [];
  const photos: string[] = [];
  const rawImages =
    itemStruct?.imagePost?.images || itemStruct?.images || [];

  if (Array.isArray(rawImages) && rawImages.length > 0) {
    rawImages.forEach((img: any, idx: number) => {
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
  const postType: TikTokPostType = isPhoto ? 'photo' : 'video';

  // 2. Author
  const author: TikTokAuthor = {
    id: String(itemStruct?.author?.id || videoObjectData?.creator?.['@id'] || ''),
    username: String(
      itemStruct?.author?.uniqueId || videoObjectData?.creator?.name || ''
    ),
    nickname: String(
      itemStruct?.author?.nickname ||
        videoObjectData?.creator?.name ||
        'TikTok Creator'
    ),
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

  // 3. Stats
  let interactionLikes = 0;
  let interactionComments = 0;
  if (Array.isArray(videoObjectData?.interactionStatistic)) {
    for (const st of videoObjectData.interactionStatistic) {
      const type = st.interactionType?.['@type'] || '';
      if (type.includes('LikeAction'))
        interactionLikes = Number(st.userInteractionCount || 0);
      if (type.includes('CommentAction'))
        interactionComments = Number(st.userInteractionCount || 0);
    }
  }

  const stats: TikTokStats = {
    views: Number(itemStruct?.stats?.playCount || 0),
    likes: Number(itemStruct?.stats?.diggCount || interactionLikes || 0),
    comments: Number(itemStruct?.stats?.commentCount || interactionComments || 0),
    shares: Number(itemStruct?.stats?.shareCount || 0),
    bookmarks: Number(itemStruct?.stats?.collectCount || 0),
  };

  // 4. Bitrates
  const bitrates: TikTokBitrate[] = [];
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

  // 5. Subtitles
  const subtitles: TikTokSubtitle[] = [];
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

  // 6. Video Media
  let video: TikTokVideoMedia | undefined;
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
        noWatermarkUrl: resolvedPlayUrl,
        downloadUrl: downloadAddr || resolvedPlayUrl,
        watermarkUrl: downloadAddr || resolvedPlayUrl,
        signedApiUrl,
        bitrates: bitrates.length > 0 ? bitrates : undefined,
        subtitles: subtitles.length > 0 ? subtitles : undefined,
        format: itemStruct?.video?.format || 'mp4',
      };
    }
  }

  // 7. Music
  let music: TikTokMusic | undefined;
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
  let comments: TikTokComment[] | undefined;
  if (commentsRaw.length > 0) {
    comments = commentsRaw.map((c: any) => ({
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

  const result: TikTokVideoResult = {
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
    const defaultMediaUrl =
      result.video.noWatermarkUrl || result.video.playUrl || '';
    result.download = (outputPath: string, options: DownloadOptions = {}) => {
      let targetUrl = defaultMediaUrl;
      if (options.quality && Array.isArray(result.video?.bitrates)) {
        if (options.quality === 'highest') {
          const sorted = [...result.video.bitrates].sort(
            (a, b) => (b.bitrate || 0) - (a.bitrate || 0)
          );
          if (sorted[0]?.url) targetUrl = sorted[0].url;
        } else if (options.quality === 'lowest') {
          const sorted = [...result.video.bitrates].sort(
            (a, b) => (a.bitrate || 0) - (b.bitrate || 0)
          );
          if (sorted[0]?.url) targetUrl = sorted[0].url;
        } else {
          const matched = result.video.bitrates.find((b) =>
            b.gearName
              ?.toLowerCase()
              .includes(String(options.quality).toLowerCase())
          );
          if (matched?.url) targetUrl = matched.url;
        }
      }
      return downloadFile(targetUrl, outputPath, cookieJar);
    };
    result.downloadBuffer = () => downloadBuffer(defaultMediaUrl, cookieJar);
  }

  if (result.isPhoto && result.photos) {
    result.downloadPhotos = (outputDir: string) =>
      downloadAllPhotos(result.photos || [], outputDir, cookieJar);
  }

  if (result.music?.playUrl) {
    result.downloadAudio = (outputPath: string) =>
      downloadAudio(result.music!.playUrl!, outputPath, cookieJar);
    result.downloadAudioBuffer = () =>
      downloadAudioBuffer(result.music!.playUrl!, cookieJar);
  }

  return result;
}

/**
 * Scrapes user profile
 */
export async function scrapeUser(inputUsername: string): Promise<TikTokUserProfile> {
  const cleanUsername = String(inputUsername || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, '')
    .replace(/^@+/, '')
    .split('/')[0]
    .split('?')[0];

  if (!cleanUsername) throw new Error('Parameter "inputUsername" is required');

  const profileUrl = `https://www.tiktok.com/@${cleanUsername}`;
  const res = await fetch(profileUrl, {
    headers: {
      'User-Agent': MOBILE_USER_AGENT,
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.tiktok.com/',
    },
    redirect: 'follow',
  });

  const html = await res.text();
  const rehydrationMatch = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
  );

  if (rehydrationMatch) {
    try {
      const data = JSON.parse(rehydrationMatch[1]);
      const userDetail = data['__DEFAULT_SCOPE__']?.['webapp.user-detail'];
      const userInfo = userDetail?.userInfo;
      if (userInfo?.user) {
        const u = userInfo.user;
        const s = userInfo.stats || {};
        return {
          id: String(u.id || ''),
          uniqueId: String(u.uniqueId || cleanUsername),
          nickname: String(u.nickname || cleanUsername),
          avatar: String(
            u.avatarLarger || u.avatarMedium || u.avatarThumb || ''
          ),
          avatarMedium: String(u.avatarMedium || u.avatarThumb || ''),
          avatarThumb: String(u.avatarThumb || ''),
          signature: String(u.signature || ''),
          bioLink: u.bioLink
            ? { link: u.bioLink.link, risk: u.bioLink.risk }
            : undefined,
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
    } catch (_) {}
  }

  throw new Error(`Could not find profile data for @${cleanUsername}`);
}

/**
 * Scrapes trending creators, hashtags, and sound tracks directly from tiktok.com
 */
export async function scrapeTrending(
  category: 'all' | 'creator' | 'hashtag' | 'music' = 'all'
): Promise<TikTokTrendingItem[]> {
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
  const results: TikTokTrendingItem[] = [];

  if (Array.isArray(json.body)) {
    for (const group of json.body) {
      if (Array.isArray(group.exploreList)) {
        for (const item of group.exploreList) {
          const cardItem = item.cardItem || {};
          let itemType: 'creator' | 'hashtag' | 'music' | 'unknown' = 'unknown';

          if (cardItem.subTitle?.startsWith('@') || group.type === 1) {
            itemType = 'creator';
          } else if (cardItem.title?.startsWith('#') || group.type === 2) {
            itemType = 'hashtag';
          } else if (group.type === 3) {
            itemType = 'music';
          }

          if (category === 'all' || category === itemType) {
            results.push({
              type: itemType,
              id: String(cardItem.id || ''),
              title: String(cardItem.title || ''),
              subTitle: cardItem.subTitle,
              desc: cardItem.desc,
              cover: cardItem.cover,
            });
          }
        }
      }
    }
  }

  return results;
}

/**
 * Scrapes hashtag info and total views
 */
export async function scrapeHashtag(tag: string): Promise<TikTokHashtagInfo> {
  const cleanTag = String(tag || '').trim().replace(/^#/, '');
  const trending = await scrapeTrending('hashtag');
  const matched = trending.find(
    (h) => h.title.toLowerCase().replace(/^#/, '') === cleanTag.toLowerCase()
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
 */
export async function scrapeSound(soundIdOrUrl: string): Promise<TikTokSoundInfo> {
  const clean = String(soundIdOrUrl || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?tiktok\.com\/music\/[^\/]+-/, '');

  const trending = await scrapeTrending('music');
  const matched = trending.find(
    (m) => m.id === clean || m.title.toLowerCase().includes(clean.toLowerCase())
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
 * Streams media buffer directly from TikTok CDN with session cookies and referer headers
 */
export async function fetchMediaStream(
  mediaUrl: string,
  cookieStr = '',
  rangeHeader?: string,
  userAgent = MOBILE_USER_AGENT
): Promise<Response> {
  if (!mediaUrl) throw new Error('Parameter "mediaUrl" is required');

  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    'Referer': 'https://www.tiktok.com/',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
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
 */
export async function downloadFile(
  mediaUrl: string,
  outputPath: string,
  cookieStr = ''
): Promise<string> {
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
    // @ts-expect-error Node Readable.fromWeb web-stream typing
    await pipeline(Readable.fromWeb(res.body), fileStream);
  } else {
    throw new Error('Response body was empty');
  }

  return outputPath;
}

/**
 * Downloads media into an in-memory Node Buffer
 */
export async function downloadBuffer(
  mediaUrl: string,
  cookieStr = ''
): Promise<Buffer> {
  if (!mediaUrl) throw new Error('Parameter "mediaUrl" is required');

  const res = await fetchMediaStream(mediaUrl, cookieStr);
  if (!res.ok) {
    throw new Error(
      `Failed to download media buffer: HTTP ${res.status} (${res.statusText || 'Forbidden'}). ` +
      `Ensure sessionCookies match the video URL signature.`
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Downloads a single photo from a slideshow
 */
export async function downloadPhoto(
  photoUrl: string,
  outputPath: string,
  cookieStr = ''
): Promise<string> {
  return downloadFile(photoUrl, outputPath, cookieStr);
}

/**
 * Downloads all photos from a TikTok photo carousel/slideshow to a target directory
 */
export async function downloadAllPhotos(
  photoUrls: string[],
  outputDir: string,
  cookieStr = ''
): Promise<string[]> {
  if (!Array.isArray(photoUrls) || photoUrls.length === 0) {
    throw new Error('Parameter "photoUrls" must be a non-empty array');
  }

  const resolvedDir = path.resolve(outputDir || './photos');
  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
  }

  const savedPaths: string[] = [];
  for (let i = 0; i < photoUrls.length; i++) {
    const filename = `photo_${String(i + 1).padStart(2, '0')}.jpg`;
    const targetPath = path.join(resolvedDir, filename);
    await downloadFile(photoUrls[i], targetPath, cookieStr);
    savedPaths.push(targetPath);
  }

  return savedPaths;
}

/**
 * Downloads audio soundtrack from TikTok media directly to local MP3 file
 */
export async function downloadAudio(
  audioUrl: string,
  outputPath: string,
  cookieStr = ''
): Promise<string> {
  return downloadFile(audioUrl, outputPath, cookieStr);
}

/**
 * Downloads audio soundtrack into an in-memory Node Buffer
 */
export async function downloadAudioBuffer(
  audioUrl: string,
  cookieStr = ''
): Promise<Buffer> {
  return downloadBuffer(audioUrl, cookieStr);
}

/**
 * Downloads multiple TikTok videos or photos in batch with progress notifications
 */
export async function batchDownload(
  urls: string[],
  outputDir = './downloads',
  options: BatchDownloadOptions = {}
): Promise<BatchItemResult[]> {
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error('Parameter "urls" must be a non-empty array of TikTok URLs');
  }
  const resolvedDir = path.resolve(outputDir);
  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
  }

  const results: BatchItemResult[] = [];
  const delayMs = typeof options.delayMs === 'number' ? options.delayMs : 300;

  for (let i = 0; i < urls.length; i++) {
    const rawUrl = String(urls[i] || '').trim();
    if (!rawUrl) continue;

    if (i > 0 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    try {
      const post = await scrapeVideo(rawUrl);
      if (post.isPhoto && post.photos && post.photos.length > 0) {
        const photoSubdir = path.join(resolvedDir, `photos_${post.id}`);
        const saved = post.downloadPhotos
          ? await post.downloadPhotos(photoSubdir)
          : await downloadAllPhotos(post.photos, photoSubdir, post.sessionCookies);
        const item: BatchItemResult = {
          url: rawUrl,
          success: true,
          id: post.id,
          postType: 'photo',
          path: photoSubdir,
          count: saved.length,
        };
        results.push(item);
        if (typeof options.onProgress === 'function') {
          options.onProgress({ current: i + 1, total: urls.length, item });
        }
      } else if (post.video) {
        const filePath = path.join(resolvedDir, `${post.id}_clean.mp4`);
        if (post.download) {
          await post.download(filePath, options);
        } else {
          const streamUrl = post.video.noWatermarkUrl || post.video.playUrl || '';
          await downloadFile(streamUrl, filePath, post.sessionCookies);
        }
        const item: BatchItemResult = {
          url: rawUrl,
          success: true,
          id: post.id,
          postType: 'video',
          path: filePath,
        };
        results.push(item);
        if (typeof options.onProgress === 'function') {
          options.onProgress({ current: i + 1, total: urls.length, item });
        }
      }
    } catch (err: any) {
      const failItem: BatchItemResult = {
        url: rawUrl,
        success: false,
        error: err.message,
      };
      results.push(failItem);
      if (typeof options.onProgress === 'function') {
        options.onProgress({ current: i + 1, total: urls.length, error: err.message });
      }
    }
  }
  return results;
}
