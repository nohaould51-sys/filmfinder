exports.handler = async function (event) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=86400"
  };

  const mode = String(event.queryStringParameters?.mode || "");
  const title = String(event.queryStringParameters?.title || "").trim().slice(0, 120);
  const year = String(event.queryStringParameters?.year || "").trim().slice(0, 4);

  const token = process.env.TMDB_API_KEY;
  if (!token) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Configuration TMDB manquante" }) };
  }

  try {
    if (mode === "popular") {
      const response = await fetch("https://api.themoviedb.org/3/movie/popular?language=fr-FR&region=FR&page=1", {
        headers: { Authorization: "Bearer " + token, Accept: "application/json" }
      });
      if (!response.ok) throw new Error("TMDB a répondu " + response.status);
      const data = await response.json();
      const results = (data.results || []).filter(movie => movie.poster_path).map(movie => ({
        t: movie.title,
        y: (movie.release_date || "").slice(0, 4),
        c: movie.overview || "Découvrez ce film populaire du moment.",
        e: "🎬",
        g: [],
        p: [],
        poster: "https://image.tmdb.org/t/p/w500" + movie.poster_path,
        k: (movie.overview || "") + " populaire",
        tmdbId: movie.id
      }));
      return { statusCode: 200, headers: { ...headers, "Cache-Control": "public, max-age=21600" }, body: JSON.stringify({ results }) };
    }

    if (!title) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Titre manquant" }) };
    }

    const search = async (withYear) => {
      const params = new URLSearchParams({
        query: title,
        language: "fr-FR",
        include_adult: "false"
      });
      if (withYear && /^\\d{4}$/.test(year)) params.set("year", year);

      const response = await fetch("https://api.themoviedb.org/3/search/movie?" + params.toString(), {
        headers: { Authorization: "Bearer " + token, Accept: "application/json" }
      });
      if (!response.ok) throw new Error("TMDB a répondu " + response.status);
      return response.json();
    };

    let data = await search(true);
    let match = (data.results || []).find(movie => movie.poster_path);
    if (!match && year) {
      data = await search(false);
      match = (data.results || []).find(movie => movie.poster_path);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        poster: match ? "https://image.tmdb.org/t/p/w500" + match.poster_path : null,
        title: match?.title || null
      })
    };
  } catch (error) {
    console.error("Erreur TMDB:", error);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: "Impossible de récupérer l’affiche TMDB" })
    };
  }
};
