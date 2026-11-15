// Runs inside an existing Zinc tab; browser cookies stay in Chrome.
async function getJson(url) {
  const response = await fetch(url, {credentials:'include', redirect:'error'});
  if (!response.ok) throw new Error('Zinc session unavailable');
  return response.json();
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'READ_ZINC') return;
  (async () => {
    const assessments = await getJson('https://api.zinc.cse.ust.hk/v1/courses/1/assessments');
    if (!Array.isArray(assessments) || assessments.length > 250) throw new Error('Unexpected assessment list');
    const groups = await Promise.all(assessments.map(async a => {
      if (!Number.isSafeInteger(a.id) || a.course_id !== 1 || typeof a.title !== 'string') throw new Error('Unexpected assessment');
      const jobs = await getJson(`https://api.zinc.cse.ust.hk/v1/assessments/${a.id}/collections`);
      if (!Array.isArray(jobs) || jobs.length > 250) throw new Error('Unexpected job list');
      return jobs.map(j => {
        if (!Number.isSafeInteger(j.id) || j.assessment_id !== a.id || typeof j.title !== 'string') throw new Error('Unexpected job');
        if (j.due_at !== null && (typeof j.due_at !== 'string' || !Number.isFinite(Date.parse(j.due_at)))) throw new Error('Unexpected deadline');
        return {source_id:String(j.id),title:jobs.length === 1 ? a.title : `${a.title} — ${j.title}`,course:'COMP1023',due_at:j.due_at,source_url:`https://zinc.cse.ust.hk/courses/1?a=${a.id}`};
      });
    }));
    respond({ok:true, items:groups.flat()});
  })().catch(() => respond({ok:false,error:'Zinc session unavailable'}));
  return true;
});
