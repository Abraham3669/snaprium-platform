// api/daily-room.js

function setCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept"
  );
  res.setHeader("Vary", "Origin");
}

export default async function handler(req, res) {
  try {
    setCors(req, res);

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    if (req.method !== "POST") {
      return res.status(200).json({
        ok: true,
        message: "daily-room API is live. Use POST to start a call.",
      });
    }

    const body = req.body || {};
    const roomId = body.roomId;
    const userName = body.userName || "Student";

    if (!roomId) {
      return res.status(400).json({ error: "Missing roomId" });
    }

    if (!process.env.DAILY_API_KEY) {
      return res.status(500).json({ error: "Missing DAILY_API_KEY on Vercel" });
    }

    const name = `snaprium-${String(roomId).slice(0, 40)}`;

    const createRes = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        privacy: "public",
        properties: {
          start_video_off: true,
          start_audio_off: true,
          enable_screenshare: true,
          enable_chat: false,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 6,
        },
      }),
    });

    let data = await createRes.json();

    if (
      createRes.status === 400 &&
      String(data?.info || data?.error || "").toLowerCase().includes("already")
    ) {
      const getRes = await fetch(`https://api.daily.co/v1/rooms/${name}`, {
        headers: {
          Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
        },
      });
      data = await getRes.json();
    }

    if (!data?.url) {
      console.error("[daily-room] Daily response", data);
      return res.status(500).json({
        error: "Could not create study call",
        details: data,
      });
    }

    return res.status(200).json({
      url: data.url,
      name,
      userName,
    });
  } catch (err) {
    console.error("[daily-room] crash", err);
    return res.status(500).json({
      error: "daily-room crashed",
      details: err.message || "Unknown error",
    });
  }
}