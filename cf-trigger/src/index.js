// Starts the newsroom GitHub Action every 30 minutes. Cloudflare crons fire on time;
// GitHub's own scheduler is often late, so it only acts as a fallback.
const REPO = "rajishere9/rkjdev";

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      const res = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.GH_TOKEN}`,
          accept: "application/vnd.github+json",
          "user-agent": "rkjdev-newsroom-trigger",
          "x-github-api-version": "2022-11-28",
        },
        body: JSON.stringify({ event_type: "newsroom", client_payload: { cron: event.cron } }),
      });
      if (!res.ok) throw new Error(`GitHub dispatch failed: ${res.status} ${await res.text()}`);
    })());
  },
};
