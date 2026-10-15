export const VERSION = 1;
export function canonicalUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('http(s)の記事URLを入力してください。');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|yclid$)/i.test(key)) url.searchParams.delete(key);
  return url.href;
}
export function classify(title, fallback = 'other') {
  const tags = ['ドラフト','FA','トレード','戦力外','育成','支配下','監督','コーチ','復帰','故障','怪我','若手','先発','日本代表','タイトル'].filter(t => title.includes(t));
  const giants = fallback === 'giants' || /巨人|ジャイアンツ|読売/.test(title);
  return { category: giants ? 'giants' : fallback, tags: giants ? ['巨人', ...tags] : tags };
}
export function mergeArticles(existing, incoming) {
  const map = new Map(existing.map(a => [canonicalUrl(a.url), a])); let added = 0;
  for (const item of incoming) {
    const url = canonicalUrl(item.url), old = map.get(url);
    if (old) map.set(url, { ...old, ...item, url, id: old.id, checked: old.checked, starred: old.starred, fetchedAt: old.fetchedAt });
    else { map.set(url, {...item, url, checked: false, starred: false}); added++; }
  }
  return { articles: [...map.values()], added };
}
const string = (x, max = 500000) => typeof x === 'string' && x.length <= max;
const date = x => typeof x === 'string' && Number.isFinite(Date.parse(x));
const tags = x => Array.isArray(x) && x.length <= 100 && x.every(t => string(t, 100));
export function validateBackup(input) {
  const fail = () => { throw new Error('JSONの形式・バージョン・記事URL・関連付けを確認してください。データは変更していません。'); };
  if (!input || input.version !== VERSION || !Array.isArray(input.articles) || !Array.isArray(input.notes) || !Array.isArray(input.articleNotes)) fail();
  if (input.articles.length > 100000 || input.notes.length > 100000 || input.articleNotes.length > 500000) fail();
  const articleIds = new Set(), urls = new Set(), noteIds = new Set(), links = new Set();
  const articles = input.articles.map(a => {
    if (!a || !string(a.id, 2200) || !a.id || articleIds.has(a.id) || !string(a.title, 3000) || !a.title.trim() || !string(a.sourceName, 200) || !string(a.sourceId, 200) || !string(a.sourceItemId, 3000) || !date(a.fetchedAt) || !(a.publishedAt === null || date(a.publishedAt)) || !['giants','npb','other'].includes(a.category) || !tags(a.tags) || typeof a.checked !== 'boolean' || typeof a.starred !== 'boolean') fail();
    let url; try { url = canonicalUrl(a.url); } catch { fail(); } if (urls.has(url)) fail();
    articleIds.add(a.id); urls.add(url);
    return {id:a.id,title:a.title,sourceName:a.sourceName,sourceId:a.sourceId,sourceItemId:a.sourceItemId,url,publishedAt:a.publishedAt,fetchedAt:a.fetchedAt,category:a.category,tags:[...a.tags],checked:a.checked,starred:a.starred};
  });
  const notes = input.notes.map(n => {
    if (!n || !string(n.id, 2200) || !n.id || noteIds.has(n.id) || !string(n.title, 3000) || !n.title.trim() || !string(n.body) || !date(n.createdAt) || !date(n.updatedAt) || !tags(n.tags)) fail();
    noteIds.add(n.id); return {id:n.id,title:n.title,body:n.body,createdAt:n.createdAt,updatedAt:n.updatedAt,tags:[...n.tags]};
  });
  const articleNotes = input.articleNotes.map(l => {
    if (!l || !articleIds.has(l.articleId) || !noteIds.has(l.noteId)) fail();
    const key = JSON.stringify([l.articleId,l.noteId]); if (links.has(key)) fail(); links.add(key);
    return {articleId:l.articleId,noteId:l.noteId};
  });
  // Device settings are intentionally not restored from untrusted JSON.
  return {version:VERSION,articles,notes,articleNotes,settings:{}};
}
export function japanDay(value = new Date()) { return new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)); }
export function chatText(articles) { return '今日確認したい記事\n\n' + articles.map((a,i) => `${i+1}.\n媒体：${a.sourceName}\nタイトル：${a.title}\nURL：${a.url}`).join('\n\n'); }
const clean = x => String(x).replace(/[\r\n]/g,' ');
const mdEscape = x => clean(x).replace(/([\\`*_[\]<>])/g,'\\$1');
export function articleMarkdown(a) { return `- 媒体：${mdEscape(a.sourceName)}\n- タイトル：${mdEscape(a.title)}\n- 公開日時：${a.publishedAt || '不明'}\n- URL：<${a.url.replace(/>/g,'%3E')}>`; }
export function markdownForNote(note, articles) {
  return `# ${japanDay(note.createdAt)} ${mdEscape(note.title)}\n\n## 元記事\n\n${articles[0] ? articleMarkdown(articles[0]) : '関連記事なし'}\n\n## 自分のメモ\n\n${note.body}\n\n## 関連記事\n\n${articles.slice(1).map(articleMarkdown).join('\n\n') || 'なし'}\n\n## タグ\n\n${note.tags.map(t=>'#'+t.replace(/[\s#]/g,'')).join('\n')}\n`;
}
export function markdownForArticle(article, notes) {
  return `# ${japanDay(article.publishedAt || article.fetchedAt)} ${mdEscape(article.title)}\n\n## 元記事\n\n${articleMarkdown(article)}\n\n## 自分のメモ\n\n${notes.map(n=>`### ${mdEscape(n.title)}\n\n${n.body}`).join('\n\n') || 'メモなし'}\n\n## タグ\n\n${article.tags.map(t=>'#'+t.replace(/[\s#]/g,'')).join('\n')}\n`;
}
