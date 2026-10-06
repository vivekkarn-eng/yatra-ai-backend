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
  // ==========================================================
  // INDORE
  // ==========================================================

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

  // ==========================================================
  // JAIPUR
  // ==========================================================

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

  // ==========================================================
  // MUMBAI
  // ==========================================================

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

  // ==========================================================
  // MYSURU
  // ==========================================================

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

  // ==========================================================
  // BHOPAL
  // ==========================================================

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

  // ==========================================================
  // OTHER MAJOR HERITAGE PLACES
  // ==========================================================

  "Khajuraho Temples, Khajuraho",
  "Taj Mahal, Agra",
  "Red Fort, Delhi",
  "Charminar, Hyderabad",
  "Sanchi Stupa, Sanchi",
];

// ============================================================
// NORMALIZE TEXT FOR RELIABLE MATCHING
// ============================================================

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// EXTRACT PLACE NAME FROM GEMINI RESULT
// ============================================================

function extractAiPlaceName(rawName) {
  let name = String(rawName || "").trim();

  // Remove common prefixes Gemini may add.
  name = name.replace(/^the\s+/i, "");

  // Gemini sometimes returns:
  // "Gateway of India, Mumbai"
  // "Gateway of India, Mumbai, Maharashtra"
  //
  // The supported YATRA name is the first part.
  if (name.includes(",")) {
    name = name.split(",")[0].trim();
  }

  return name;
}

// ============================================================
// FIND MATCHED YATRA PLACE
// ============================================================

function findMatchedPlace(result) {
  const rawName = String(result?.name || "").trim();
  const rawCity = String(result?.city || "").trim();

  if (!rawName) {
    return null;
  }

  const aiName = normalizeText(rawName);
  const aiCity = normalizeText(rawCity);

  // ----------------------------------------------------------
  // First attempt:
  // Exact/strong name + city matching
  // ----------------------------------------------------------

  for (const place of YATRA_PLACES) {
    const parts = place.split(",");

    const supportedName = normalizeText(parts[0]);

    const supportedCity = normalizeText(
      parts.slice(1).join(",")
    );

    const nameMatches =
      aiName === supportedName ||
      aiName.includes(supportedName) ||
      supportedName.includes(aiName);

    const cityMatches =
      !aiCity ||
      aiCity === supportedCity ||
      aiCity.includes(supportedCity) ||
      supportedCity.includes(aiCity);

    if (nameMatches && cityMatches) {
      return place;
    }
  }

  // ----------------------------------------------------------
  // Second attempt:
  // Extract the monument name before any comma.
  //
  // Example:
  // "Gateway of India, Mumbai"
  // becomes:
  // "Gateway of India"
  // ----------------------------------------------------------

  const extractedName = normalizeText(
    extractAiPlaceName(rawName)
  );

  if (extractedName) {
    for (const place of YATRA_PLACES) {
      const supportedName = normalizeText(
        place.split(",")[0]
      );

      if (
        extractedName === supportedName ||
        extractedName.includes(supportedName) ||
        supportedName.includes(extractedName)
      ) {
        return place;
      }
    }
  }

  // ----------------------------------------------------------
  // Third attempt:
  // Compare important words in the name.
  //
  // This helps with small naming variations such as:
  // "Gateway of India Monument"
  // "Gateway of India"
  // "The Gateway of India"
  // ----------------------------------------------------------

  const aiWords = new Set(
    normalizeText(extractedName || rawName)
      .split(" ")
      .filter((word) => word.length > 2)
  );

  let bestMatch = null;
  let bestScore = 0;

  for (const place of YATRA_PLACES) {
    const supportedName = normalizeText(
      place.split(",")[0]
    );

    const supportedWords = supportedName
      .split(" ")
      .filter((word) => word.length > 2);

    if (supportedWords.length === 0) {
      continue;
    }

    let matchedWords = 0;

    for (const word of supportedWords) {
      if (aiWords.has(word)) {
        matchedWords++;
      }
    }

    const score =
      matchedWords / supportedWords.length;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = place;
    }
  }

  // Require a strong word-level match.
  if (bestMatch && bestScore >= 0.7) {
    return bestMatch;
  }

  return null;
}

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
    console.log("YATRA AI IMAGE RECOGNITION");
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

    // ----------------------------------------------------------
    // Give Gemini the complete YATRA place list
    // ----------------------------------------------------------

    const supportedPlacesText = YATRA_PLACES
      .map((place) => `- ${place}`)
      .join("\n");

    const prompt = `
You are YATRA AI, an Indian heritage monument recognition system.

Your task is to identify the monument or landmark shown in the supplied image.

IMPORTANT:
You MUST compare the image against the YATRA supported-place list below.

YATRA SUPPORTED PLACES:

${supportedPlacesText}

RECOGNITION INSTRUCTIONS:

1. Carefully inspect the entire image.
2. Look at architecture, facade, domes, towers, arches, windows,
   colors, structure, surroundings and other distinctive visual features.
3. Identify the most likely supported YATRA place.
4. Prefer a supported place when the visual evidence genuinely
   supports it.
5. Do NOT invent a place outside the supported list.
6. If the image clearly matches a supported place, return that place.
7. If the image is genuinely unclear or does not match any supported
   place, return "Unknown place".
8. Use a confidence value between 0 and 1.
9. Confidence should represent your visual certainty.
10. Do not return explanations.

IMPORTANT OUTPUT RULE:

The "name" field should contain ONLY the monument/place name.

DO NOT put the city inside the "name" field.

For example:

CORRECT:
{
  "name": "Gateway of India",
  "city": "Mumbai",
  "state": "Maharashtra",
  "confidence": 0.99
}

NOT PREFERRED:
{
  "name": "Gateway of India, Mumbai",
  "city": "Mumbai",
  "state": "Maharashtra",
  "confidence": 0.99
}

Another example:

{
  "name": "Taj Mahal",
  "city": "Agra",
  "state": "Uttar Pradesh",
  "confidence": 0.95
}

If the image is Hawa Mahal:

{
  "name": "Hawa Mahal",
  "city": "Jaipur",
  "state": "Rajasthan",
  "confidence": 0.95
}

Return ONLY valid JSON.

Format:

{
  "name": "Place name",
  "city": "City",
  "state": "State",
  "confidence": 0.00
}

If the image cannot be identified:

{
  "name": "Unknown place",
  "city": "",
  "state": "",
  "confidence": 0.00
}
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
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    // ----------------------------------------------------------
    // Clean Gemini JSON response
    // ----------------------------------------------------------

    resultText = resultText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    console.log("Gemini raw result:");
    console.log(resultText);

    const result = JSON.parse(resultText);

    // ----------------------------------------------------------
    // Basic validation
    // ----------------------------------------------------------

    if (!result.name) {
      throw new Error(
        "AI response did not contain a place name."
      );
    }

    // ----------------------------------------------------------
    // Unknown place
    // ----------------------------------------------------------

    if (
      String(result.name)
        .trim()
        .toLowerCase() === "unknown place"
    ) {
      return res.status(200).json({
        name: "Unknown place",
        city: "",
        state: "",
        confidence: 0,
      });
    }

    // ----------------------------------------------------------
    // MATCH AGAINST ALL 55 YATRA PLACES
    // ----------------------------------------------------------

    const matchedPlace = findMatchedPlace(result);

    // ----------------------------------------------------------
    // Unsupported result
    // ----------------------------------------------------------

    if (!matchedPlace) {
      console.log("⚠️ Unsupported AI result:");
      console.log(result);

      return res.status(200).json({
        name: "Unknown place",
        city: "",
        state: "",
        confidence: 0,
      });
    }

    // ----------------------------------------------------------
    // Get official YATRA name and city
    // ----------------------------------------------------------

    const matchedParts = matchedPlace.split(",");

    const finalName = matchedParts[0].trim();

    const finalCity = matchedParts
      .slice(1)
      .join(",")
      .trim();

    // ----------------------------------------------------------
    // Normalize confidence
    // ----------------------------------------------------------

    let confidence = Number(result.confidence);

    if (!Number.isFinite(confidence)) {
      confidence = 0;
    }

    confidence = Math.max(
      0,
      Math.min(1, confidence)
    );

    // ----------------------------------------------------------
    // Final result
    // ----------------------------------------------------------

    const finalResult = {
      name: finalName,
      city: finalCity,
      state: result.state || "",
      confidence: confidence,
    };

    console.log("=================================");
    console.log("✅ YATRA RECOGNIZED:");
    console.log(finalResult);
    console.log("=================================");

    res.status(200).json(finalResult);

  } catch (error) {
    console.error("");
    console.error(
      "========== RECOGNITION ERROR =========="
    );
    console.error(error);
    console.error(
      "======================================="
    );
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

const PORT = 3000;

app.listen(PORT, () => {
  console.log("");
  console.log("=================================");
  console.log("YATRA AI backend is running!");
  console.log(`http://localhost:${PORT}`);
  console.log(
    `Supported places: ${YATRA_PLACES.length}`
  );
  console.log("=================================");
  console.log("");
});

// Keep Node process alive
process.stdin.resume();