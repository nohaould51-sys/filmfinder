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

    if (mode === "recommendations") {
      if (!title) return { statusCode: 400, headers, body: JSON.stringify({ results: [] }) };
      const params = new URLSearchParams({ query: title, language: "fr-FR", include_adult: "false" });
      if (/^\\d{4}$/.test(year)) params.set("year", year);
      const searchResponse = await fetch("https://api.themoviedb.org/3/search/movie?" + params.toString(), {
        headers: { Authorization: "Bearer " + token, Accept: "application/json" }
      });
      if (!searchResponse.ok) throw new Error("TMDB a répondu " + searchResponse.status);
      let searchData = await searchResponse.json();
      let movie = (searchData.results || [])[0];
      if (!movie && year) {
        params.delete("year");
        const retry = await fetch("https://api.themoviedb.org/3/search/movie?" + params.toString(), {
          headers: { Authorization: "Bearer " + token, Accept: "application/json" }
        });
        if (!retry.ok) throw new Error("TMDB a répondu " + retry.status);
        searchData = await retry.json();
        movie = (searchData.results || [])[0];
      }
      if (!movie) return { statusCode: 200, headers, body: JSON.stringify({ results: [] }) };
      const recResponse = await fetch("https://api.themoviedb.org/3/movie/" + movie.id + "/recommendations?language=fr-FR&page=1", {
        headers: { Authorization: "Bearer " + token, Accept: "application/json" }
      });
      if (!recResponse.ok) throw new Error("TMDB a répondu " + recResponse.status);
      const recData = await recResponse.json();
      const results = (recData.results || []).filter(x => x.poster_path).slice(0, 8).map(x => ({
        t: x.title, y: (x.release_date || "").slice(0, 4), c: x.overview || "",
        e: "🎬", g: [], p: [], poster: "https://image.tmdb.org/t/p/w500" + x.poster_path,
        k: x.overview || "", tmdbId: x.id
      }));
      return { statusCode: 200, headers: { ...headers, "Cache-Control": "public, max-age=21600" }, body: JSON.stringify({ results }) };
    }

    if (mode === "providers") {
      if (!title) return { statusCode: 400, headers, body: JSON.stringify({ error: "Titre manquant" }) };
      const params = new URLSearchParams({ query: title, language: "fr-FR", include_adult: "false" });
      if (/^\\d{4}$/.test(year)) params.set("year", year);
      const searchResponse = await fetch("https://api.themoviedb.org/3/search/movie?" + params.toString(), {
        headers: { Authorization: "Bearer " + token, Accept: "application/json" }
      });
      if (!searchResponse.ok) throw new Error("TMDB a répondu " + searchResponse.status);
      let searchData = await searchResponse.json();
      let movie = (searchData.results || [])[0];
      if (!movie && year) {
        params.delete("year");
        const retry = await fetch("https://api.themoviedb.org/3/search/movie?" + params.toString(), {
          headers: { Authorization: "Bearer " + token, Accept: "application/json" }
        });
        if (!retry.ok) throw new Error("TMDB a répondu " + retry.status);
        searchData = await retry.json();
        movie = (searchData.results || [])[0];
      }
      if (!movie) return { statusCode: 200, headers, body: JSON.stringify({ providers: [] }) };
      const providerResponse = await fetch("https://api.themoviedb.org/3/movie/" + movie.id + "/watch/providers", {
        headers: { Authorization: "Bearer " + token, Accept: "application/json" }
      });
      if (!providerResponse.ok) throw new Error("TMDB a répondu " + providerResponse.status);
      const providerData = await providerResponse.json();
      const france = providerData.results?.FR || {};
      const providers = [...(france.flatrate || []), ...(france.free || []), ...(france.ads || [])]
        .map(provider => provider.provider_name).filter((name, index, all) => all.indexOf(name) === index);
      return {
        statusCode: 200,
        headers: { ...headers, "Cache-Control": "public, max-age=21600" },
        body: JSON.stringify({ providers, link: france.link || null, country: "FR" })
      };
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
