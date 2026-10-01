const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(cors());
app.use(express.json({ limit: "15mb" }));

// ============================================================
// CHECK GEMINI API KEY
// ============================================================

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is missing from .env");
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ============================================================
// YATRA SUPPORTED PLACES
// ============================================================

const YATRA_PLACES = [

  // ----------------------------------------------------------
  // INDORE
  // ----------------------------------------------------------

  "Rajwada, Indore",
  "Lal Bagh Palace, Indore",
  "Krishnapura Chhatris, Indore",
  "Kanch Mandir, Indore",
  "Annapurna Temple, Indore",
  "Bada Ganpati, Indore",
  "Gandhi Hall, Indore",
  "Central Museum, Indore",
  "Ralamandal Wildlife Sanctuary, Indore",
  "Pipliyapala Regional Park, Indore",

  // ----------------------------------------------------------
  // JAIPUR
  // ----------------------------------------------------------

  "Hawa Mahal, Jaipur",
  "Amber Fort, Jaipur",
  "City Palace Jaipur, Jaipur",
  "Jantar Mantar Jaipur, Jaipur",
  "Jal Mahal, Jaipur",
  "Nahargarh Fort, Jaipur",
  "Jaigarh Fort, Jaipur",
  "Albert Hall Museum, Jaipur",
  "Galtaji Temple, Jaipur",
  "Birla Mandir Jaipur, Jaipur",

  // ----------------------------------------------------------
  // MUMBAI
  // ----------------------------------------------------------

  "Gateway of India, Mumbai",
  "Chhatrapati Shivaji Maharaj Terminus, Mumbai",
  "Elephanta Caves, Mumbai",
  "Chhatrapati Shivaji Maharaj Vastu Sangrahalaya, Mumbai",
  "Siddhivinayak Temple, Mumbai",
  "Haji Ali Dargah, Mumbai",
  "Kanheri Caves, Mumbai",
  "Bandra-Worli Sea Link, Mumbai",
  "Sanjay Gandhi National Park, Mumbai",
  "Marine Drive, Mumbai",

  // ----------------------------------------------------------
  // MYSURU
  // ----------------------------------------------------------

  "Mysore Palace, Mysuru",
  "Chamundi Hill, Mysuru",
  "Chamundeshwari Temple, Mysuru",
  "St. Philomena Cathedral, Mysuru",
  "Jaganmohan Palace, Mysuru",
  "Karanji Lake, Mysuru",
  "Railway Museum Mysuru, Mysuru",
  "Devaraja Market, Mysuru",
  "Lalitha Mahal Palace, Mysuru",
  "Mysuru Zoo, Mysuru",

  // ----------------------------------------------------------
  // BHOPAL
  // ----------------------------------------------------------

  "Taj-ul-Masajid, Bhopal",
  "Upper Lake, Bhopal",
  "Van Vihar National Park, Bhopal",
  "Bharat Bhavan, Bhopal",
  "Tribal Museum Bhopal, Bhopal",
  "Gohar Mahal, Bhopal",
  "Moti Masjid Bhopal, Bhopal",
  "Sadar Manzil, Bhopal",
  "Birla Mandir Bhopal, Bhopal",
  "Regional Science Centre Bhopal, Bhopal",
];

// ============================================================
// TEST ROUTE
// ============================================================

app.get("/", (req, res) => {
  res.json({
    message: "YATRA AI backend is running!",
    supportedPlaces: YATRA_PLACES.length,
  });
});

// ============================================================
// GENERATE AI STORY
// ============================================================

app.post("/generate-story", async (req, res) => {
  try {
    const { place } = req.body;

    console.log("=================================");
    console.log("YATRA AI request received");
    console.log("Place:", place);
    console.log("=================================");

    if (!place) {
      return res.status(400).json({
        error: "Place name is required",
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Gemini API key is missing",
      });
    }

    const prompt = `
You are YATRA AI, an Indian heritage and tourism guide.

Explain the following place for a tourist:

${place}

Give a detailed but easy-to-understand explanation.

Use these sections:

THE STORY
HISTORY
ARCHITECTURE
WHAT MAKES IT SPECIAL
DID YOU KNOW?
VISITOR CONTEXT

Rules:
- Keep the information factual.
- Do not invent facts.
- Use simple and engaging language.
- Give enough detail to make the explanation useful for a tourist.
- If you are uncertain about a fact, do not state it as certain.
`;

    console.log("Sending request to Gemini...");

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
    });

    console.log("Gemini response received successfully.");

    const story = response.text;

    if (!story) {
      throw new Error("Gemini returned an empty response.");
    }

    res.status(200).json({
      place: place,
      story: story,
    });

  } catch (error) {
    console.error("");
    console.error("========== GEMINI ERROR ==========");
    console.error(error);
    console.error("==================================");
    console.error("");

    res.status(500).json({
      error: "Failed to generate story",
      details: error?.message || String(error),
    });
  }
});

// ============================================================
// AI PLACE RECOGNITION
// ============================================================

app.post("/recognize-place", async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    console.log("=================================");
    console.log("YATRA AI image recognition request");
    console.log("=================================");

    if (!imageBase64) {
      return res.status(400).json({
        error: "Image is required",
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Gemini API key is missing",
      });
    }

    const supportedPlacesText = YATRA_PLACES
      .map((place) => `- ${place}`)
      .join("\n");

    const prompt = `
You are YATRA AI, an Indian heritage and tourism recognition assistant.

Look carefully at the supplied image.

Your job is to identify whether the image shows one of the places supported by YATRA.

YATRA currently supports these places:

${supportedPlacesText}

IMPORTANT:
- Compare the visual features of the image carefully with the supported places.
- Prefer a supported place ONLY when the image genuinely matches.
- Do not invent a place name.
- Do not return a place that is not in the supported list.
- If the image does not clearly match a supported place, return "Unknown place".
- If the image is unclear, use a lower confidence value.

Return ONLY valid JSON in exactly this format:

{
  "name": "Place name",
  "city": "City",
  "state": "State",
  "confidence": 0.00
}

For an unsupported or unclear image, return:

{
  "name": "Unknown place",
  "city": "",
  "state": "",
  "confidence": 0.00
}

Rules:
- confidence must be a number between 0 and 1.
- Do not include markdown.
- Do not include explanations.
- The "name" must exactly match one of the supported place names above OR be "Unknown place".
- The city must correspond to the selected supported place.
`;

    console.log("Sending image to Gemini...");

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",

      contents: [
        {
          inlineData: {
            mimeType: mimeType || "image/jpeg",
            data: imageBase64,
          },
        },
        {
          text: prompt,
        },
      ],
    });

    console.log("Gemini recognition response received.");

    let resultText = response.text?.trim();

    if (!resultText) {
      throw new Error("Gemini returned an empty response.");
    }

    // Remove markdown code fences if Gemini adds them.
    resultText = resultText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const result = JSON.parse(resultText);

    // ========================================================
    // VALIDATE AI RESULT
    // ========================================================

    if (!result.name) {
      throw new Error("AI response did not contain a place name.");
    }

    // Unknown place is valid.
    if (result.name === "Unknown place") {
      return res.status(200).json({
        name: "Unknown place",
        city: "",
        state: "",
        confidence: 0,
      });
    }

    // Make sure AI returned a supported place.
    const matchedPlace = YATRA_PLACES.find(
      (place) => place === `${result.name}, ${result.city}`
    );

    if (!matchedPlace) {
      console.log("Unsupported AI result:", result);

      return res.status(200).json({
        name: "Unknown place",
        city: "",
        state: "",
        confidence: 0,
      });
    }

    // Normalize confidence.
    let confidence = Number(result.confidence);

    if (!Number.isFinite(confidence)) {
      confidence = 0;
    }

    confidence = Math.max(
      0,
      Math.min(1, confidence)
    );

    const finalResult = {
      name: result.name,
      city: result.city,
      state: result.state,
      confidence: confidence,
    };

    console.log("Recognized place:", finalResult);

    res.status(200).json(finalResult);

  } catch (error) {
    console.error("");
    console.error("========== RECOGNITION ERROR ==========");
    console.error(error);
    console.error("=======================================");
    console.error("");

    res.status(500).json({
      error: "Failed to recognize place",
      details: error?.message || String(error),
    });
  }
});

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("");
  console.log("=================================");
  console.log("YATRA AI backend is running!");
  console.log(`http://localhost:${PORT}`);
  console.log(`Supported places: ${YATRA_PLACES.length}`);
  console.log("=================================");
  console.log("");
});

// Keep Node process alive.
process.stdin.resume();