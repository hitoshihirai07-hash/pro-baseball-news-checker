// 個人用記事確認。公式一覧とRSSから記事メタデータだけを返します。
export const sources = [
  {id:'hochi-giants', name:'スポーツ報知', label:'スポーツ報知（巨人）', type:'hochi-list', url:'https://hochi.news/tag/%E5%B7%A8%E4%BA%BA', category:'giants', home:'https://hochi.news/tag/%E5%B7%A8%E4%BA%BA', method:'公式サイトの巨人記事一覧'},
  {id:'full-count-giants', name:'Full-Count', label:'Full-Count（巨人）', url:'https://full-count.jp/category/npb/central-league/kyojin/feed/', category:'giants', home:'https://full-count.jp/category/npb/central-league/kyojin/'},
  {id:'full-count-npb', name:'Full-Count', url:'https://full-count.jp/category/npb/feed/', category:'npb', home:'https://full-count.jp/category/npb/'},
];
export const sourceLinks = [
  {name:'日刊スポーツ',url:'https://www.nikkansports.com/baseball/professional/team/giants/',reason:'公式RSSの再配信制限があるため、代理取得は無効'},
  {name:'スポニチ',url:'https://www.sponichi.co.jp/baseball/',reason:'公式記事一覧からの自動取得は未実装。現在は元サイト閲覧・手動追加で対応'},
  {name:'サンスポ',url:'https://www.sanspo.com/sports/baseball/',reason:'公式記事一覧からの自動取得は未実装。現在は元サイト閲覧・手動追加で対応'},
];
