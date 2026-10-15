import {api} from '../../src/worker.mjs';

// Cloudflare Pages Functions: /api/* を静的HTMLではなく取得APIへ渡す。
export async function onRequest({request}) {
  try {
    return await api(request) || Response.json({error:'APIが見つかりません。'},{status:404});
  } catch {
    return Response.json({error:'記事取得APIでエラーが発生しました。時間をおいて再試行してください。'},{status:502});
  }
}
