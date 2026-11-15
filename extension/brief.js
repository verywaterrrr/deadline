// Reads only the two known report conversations. No cookies or login data leave ChatGPT.
const ALLOWED = new Set(['/c/6a907813-3f50-83e9-abcf-cc1d4f32871b','/c/6ae54b04-9f24-83e8-b9c8-8326e2f9ec67']);
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'READ_BRIEF' || !ALLOWED.has(location.pathname)) return;
  const reports = [...document.querySelectorAll('[data-content-search-turn-key]')].flatMap(turn => {
    if (turn.querySelector('[data-talvt-turn-state]:not([data-talvt-turn-state="complete"])')) return [];
    const generatedAt = turn.querySelector('time[datetime]')?.getAttribute('datetime');
    return [...turn.querySelectorAll('[data-response-body]')].flatMap(body => {
      const root = body.querySelector('[data-dil-response]') || body.querySelector('[data-markdown-text-style="assistant-message"]');
      if (!root || !generatedAt || !root.innerText.trimStart().startsWith('Hi Arvin, here is ur summary for today:')) return [];
      const sections=[]; let section=null;
      for (const node of root.children) {
        const text=(node.innerText||'').trim(); if (!text) continue;
        if (/^H[1-6]$/.test(node.tagName)) { section={heading:text,items:[]}; sections.push(section); continue; }
        if (!section) continue;
        if (/^(UL|OL)$/.test(node.tagName)) {
          for (const li of node.children) if(li.innerText.trim()) section.items.push(li.innerText.trim());
        } else section.items.push(text);
      }
      const id=body.getAttribute('data-response-body');
      return id && sections.length ? [{messageId:id,generatedAt,sections}] : [];
    });
  }).sort((a,b)=>Date.parse(b.generatedAt)-Date.parse(a.generatedAt));
  reply(reports.length ? {ok:true,report:reports[0]} : {ok:false,error:'No complete report found in this conversation'});
});
