export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    receivedOrigin: req.headers.origin || "(no origin header sent)",
    userAgent: req.headers["user-agent"] || "(none)",
  });
}