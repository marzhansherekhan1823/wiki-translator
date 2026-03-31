import { useState } from "react";
import "./App.css";

function App() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [translatedText, setTranslatedText] = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingTranslate, setLoadingTranslate] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!query.trim()) {
      setError("Please enter a search word");
      return;
    }

    try {
      setLoadingSearch(true);
      setError("");
      setResult(null);
      setTranslatedText("");

      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const response = await fetch(
        `${API_URL}/search?query=${encodeURIComponent(query)}&lang=en`
      );

      const rawText = await response.text();

      if (!rawText) {
        throw new Error("Backend returned empty response");
      }

      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Backend did not return valid JSON: ${rawText}`);
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch article");
      }

      setResult(data);
    } catch (err) {
      setError(err.message || "Failed to fetch");
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleTranslate = async () => {
    if (!result?.extract) {
      setError("No text to translate");
      return;
    }

    try {
      setLoadingTranslate(true);
      setError("");

      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const response = await fetch(`${API_URL}/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: result.extract,
          sourceLang: "en",
          targetLang: "kk"
        })
      });

      const rawText = await response.text();

      if (!rawText) {
        throw new Error("Backend returned empty response");
      }

      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Backend did not return valid JSON: ${rawText}`);
      }

      if (!response.ok) {
        throw new Error(data.error || "Translation failed");
      }

      setTranslatedText(data.translatedText);
    } catch (err) {
      setError(err.message || "Translation failed");
    } finally {
      setLoadingTranslate(false);
    }
  };

  return (
    <div className="app">
      <div className="container">
        <h1>Wiki Translator</h1>
        <p className="subtitle">
          Search a Wikipedia topic and translate it into Kazakh
        </p>

        <div className="search-box">
          <input
            type="text"
            placeholder="Enter a topic, for example: CPU"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
          />
          <button onClick={handleSearch} disabled={loadingSearch}>
            {loadingSearch ? "Searching..." : "Search"}
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        {result && (
          <div className="card">
            <h2>{result.title}</h2>

            {result.image ? (
              <img
                src={result.image}
                alt={result.title}
                className="result-image"
              />
            ) : (
              <p className="no-image">No image available</p>
            )}

            <div className="text-block">
              <h3>Original Text</h3>
              <p>{result.extract || "No text available"}</p>
            </div>

            <button
              className="translate-btn"
              onClick={handleTranslate}
              disabled={loadingTranslate}
            >
              {loadingTranslate ? "Translating..." : "Translate to Kazakh"}
            </button>

            {translatedText && (
              <div className="text-block translated">
                <h3>Translated Text</h3>
                <p>{translatedText}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
