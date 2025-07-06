export default async function handler(req, res) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const base64 = req.body?.imageBase64;
  if (!apiKey || !base64) {
    return res.status(400).json({ error: "Missing image or API key." });
  }

  const payload = {
    model: "mistralai/mistral-small-3.2-24b-instruct:free",
    messages: [
      {
        role: "system",
        content: "Kamu adalah asisten AI yang hanya membantu membuat prompt untuk image generation model flux, turbo, dan gptimage. Jawab hanya seputar pembuatan prompt, jangan menjawab hal lain."
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Analisa gambar ini dan buatkan prompt yang mendeskripsikan gambar ini secara detail, artistik, dan cocok untuk AI image generator. Balas hanya prompt-nya saja, tanpa penjelasan lain." },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }
        ]
      }
    ]
  };

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Gagal komunikasi dengan API");
    }

    const data = await response.json();
    const prompt = data.choices?.[0]?.message?.content?.trim() || "Tidak dapat menganalisa gambar.";
    res.status(200).json({ prompt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
