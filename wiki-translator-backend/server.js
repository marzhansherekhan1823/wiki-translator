require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  })
);

app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3001;
const USER_AGENT = "WikiTranslatorUniProject/1.0 (contact: student)";
const WIKI_TIMEOUT_MS = 15000;
const TRANSLATE_TIMEOUT_MS = 20000;
const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://wiki-python-ai:8000/translate";

const CHUNK_SIZE = 450;
const MAX_CHUNKS = 5;

function getFirstPage(pagesObj) {
  const pages = pagesObj || {};
  const pageId = Object.keys(pages)[0] || null;

  return {
    pageId,
    page: pageId ? pages[pageId] : null,
    pages,
  };
}

async function fetchWikipediaIntro(query, lang = "en") {
  const wikiUrl = `https://${lang}.wikipedia.org/w/api.php`;

  const response = await axios.get(wikiUrl, {
    params: {
      action: "query",
      format: "json",
      prop: "extracts|pageimages",
      exintro: true,
      explaintext: true,
      redirects: 1,
      titles: query,
      piprop: "thumbnail",
      pithumbsize: 400,
      origin: "*",
    },
    headers: {
      "User-Agent": USER_AGENT,
    },
    timeout: WIKI_TIMEOUT_MS,
  });

  const { page } = getFirstPage(response.data?.query?.pages);

  if (!page || page.missing !== undefined) {
    return null;
  }

  return {
    title: page.title,
    extract: page.extract || "",
    image: page.thumbnail ? page.thumbnail.source : null,
    lang,
  };
}

function splitIntoChunks(text, chunkSize = CHUNK_SIZE, maxChunks = MAX_CHUNKS) {
  const cleanedText = (text || "").trim();
  const chunks = [];

  for (let i = 0; i < cleanedText.length; i += chunkSize) {
    if (chunks.length >= maxChunks) break;
    chunks.push(cleanedText.slice(i, i + chunkSize));
  }

  return chunks;
}

async function translateChunk(chunk, sourceLang = "en", targetLang = "kk") {
  try {
    
    const response = await axios.post(PYTHON_AI_URL, {
      text: chunk 
    }, {
      timeout: TRANSLATE_TIMEOUT_MS,
    });

    
    return response.data?.translated || "";
  } catch (error) {
    console.error("Local AI Translation error:", error.message);
    return "Ошибка перевода через AI";
  }
}

async function translateTextInChunks(text, sourceLang = "en", targetLang = "kk") {
  const chunks = splitIntoChunks(text);

  if (chunks.length === 0) return "";

  const translatedChunks = [];

  for (const chunk of chunks) {
    const translated = await translateChunk(chunk, sourceLang, targetLang);
    translatedChunks.push(translated);
  }

  return translatedChunks.join(" ");
}

app.get("/", (req, res) => {
  res.json({ message: "Wiki Translator Backend is running" });
});

app.get("/search", async (req, res) => {
  try {
    const { query, lang = "en" } = req.query;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: "Query is required" });
    }

    const article = await fetchWikipediaIntro(query, lang);

    if (!article) {
      return res.status(404).json({ error: "Wikipedia article not found" });
    }

    res.json(article);
  } catch (error) {
    console.error("Wikipedia error:", error.message);
    res.status(500).json({
      error: "Failed to fetch Wikipedia article",
      details: error.message,
    });
  }
});

app.post("/translate", async (req, res) => {
  try {
    const { text, sourceLang = "en", targetLang = "kk" } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text is required" });
    }

    const translatedText = await translateTextInChunks(
      text,
      sourceLang,
      targetLang
    );

    const chunksUsed = splitIntoChunks(text).length;

    res.json({
      translatedText,
      sourceLang,
      targetLang,
      chunkSize: CHUNK_SIZE,
      chunksUsed,
      translatedChars: Math.min(text.length, CHUNK_SIZE * MAX_CHUNKS),
    });
  } catch (error) {
    console.error("Translation error:", error.message);
    res.status(500).json({
      error: "Translation failed",
      details: error.message,
    });
  }
});

app.get("/search-and-translate", async (req, res) => {
  try {
    const {
      query,
      wikiLang = "en",
      sourceLang = "en",
      targetLang = "kk",
    } = req.query;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: "Query is required" });
    }

    const article = await fetchWikipediaIntro(query, wikiLang);

    if (!article) {
      return res.status(404).json({ error: "Wikipedia article not found" });
    }

    const translatedText = await translateTextInChunks(
      article.extract,
      sourceLang,
      targetLang
    );

    const chunksUsed = splitIntoChunks(article.extract).length;

    res.json({
      title: article.title,
      image: article.image,
      originalText: article.extract,
      translatedText,
      wikiLang,
      sourceLang,
      targetLang,
      chunkSize: CHUNK_SIZE,
      chunksUsed,
      translatedChars: Math.min(
        article.extract.length,
        CHUNK_SIZE * MAX_CHUNKS
      ),
    });
  } catch (error) {
    console.error("Search and translate error:", error.message);
    res.status(500).json({
      error: "Failed to search and translate",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
