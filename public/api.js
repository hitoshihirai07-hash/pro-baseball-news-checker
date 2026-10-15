export async function readApiJson(response) {
  const type=response.headers.get('content-type')||'';
  if(!/\bapplication\/(?:[\w.+-]+\+)?json\b/i.test(type)) {
    throw new Error('記事取得APIからHTMLなどのページが返されました。Pages Functions（functionsフォルダ）が公開されているか確認してください。保存済みデータは利用できます。');
  }
  let data;
  try {data=await response.json();}
  catch {throw new Error('記事取得APIのJSONが不正です。時間をおいて再試行してください。');}
  if(!response.ok)throw new Error(typeof data?.error==='string'?data.error:`記事取得APIに接続できません（${response.status}）`);
  return data;
}
