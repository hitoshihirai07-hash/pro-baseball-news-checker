// 個人用RSSリーダー。本文は抽出せず、記事メタデータだけを返します。
export const sources = [
  {id:'full-count-giants', name:'Full-Count', label:'Full-Count（巨人）', url:'https://full-count.jp/category/npb/central-league/kyojin/feed/', category:'giants', home:'https://full-count.jp/category/npb/central-league/kyojin/'},
  {id:'full-count-npb', name:'Full-Count', url:'https://full-count.jp/category/npb/feed/', category:'npb', home:'https://full-count.jp/category/npb/'},
];
export const sourceLinks = [
  {name:'スポーツ報知',url:'https://hochi.news/giants/',reason:'安定した公式RSSを未確認。元サイト閲覧・手動追加で対応'},
  {name:'日刊スポーツ',url:'https://www.nikkansports.com/baseball/professional/team/giants/',reason:'公式RSSの再配信制限があるため、代理取得は無効'},
  {name:'スポニチ',url:'https://www.sponichi.co.jp/baseball/',reason:'安定した公式RSSを未確認。元サイト閲覧・手動追加で対応'},
  {name:'サンスポ',url:'https://www.sanspo.com/sports/baseball/',reason:'安定した公式RSSを未確認。元サイト閲覧・手動追加で対応'},
];
