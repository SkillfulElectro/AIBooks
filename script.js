window.addEventListener("DOMContentLoaded", () => {
  const BOOKS_INDEX = "./books.json";
  const booksArea = document.getElementById("booksArea");
  const listEl = document.getElementById("list");
  const jsError = document.getElementById("jsErrorPlaceholder");
  const searchInput = document.getElementById("search");
  const scrollTopBtn = document.getElementById("scrollTopBtn");

  let booksIndex = [];
  let currentBook = null;

  function showError(msg) {
    jsError.style.display = "block";
    jsError.textContent = msg;
  }

  function clearError() {
    jsError.style.display = "none";
    jsError.textContent = "";
  }

  function saveProgress(map, bookName) {
    localStorage.setItem("progress::" + bookName, JSON.stringify(map));
  }

  function loadProgress(bookName) {
    try {
      return JSON.parse(localStorage.getItem("progress::" + bookName) || "{}");
    } catch (e) {
      return {};
    }
  }

  function makeQueryUrl(note, mode) {
    const base = "https://chatgpt.com/";
    const q = encodeURIComponent(note || "");
    const hints = mode === "search" ? "search" : "study";
    return `${base}?q=${q}&hints=${hints}&ref=ext`;
  }

  async function fetchJsonSafe(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok)
      throw new Error(
        `Failed to fetch ${url} — ${res.status} ${res.statusText}`
      );
    return res.json();
  }

  function renderBookButtons(filter = "") {
    booksArea.innerHTML = "";
    const filteredBooks = booksIndex.filter((b) =>
      b.name.toLowerCase().includes(filter.toLowerCase())
    );

    if (filteredBooks.length === 0) {
      booksArea.innerHTML =
        '<div class="text-gray-400">No books found.</div>';
      return;
    }

    filteredBooks.forEach((b, idx) => {
      const btn = document.createElement("button");
      btn.className =
        "bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded book-btn";
      btn.textContent = b.name || `Book ${idx + 1}`;
      btn.dataset.file = b.file || b.filename || b.path || "";
      btn.title = b.file || "";
      btn.addEventListener("click", () => {
        selectBook(b, btn);
      });
      booksArea.appendChild(btn);
    });
  }

  async function selectBook(book, btnEl) {
    clearError();
    document
      .querySelectorAll(".book-btn")
      .forEach((x) => x.classList.remove("bg-blue-600", "hover:bg-blue-700"));
    btnEl.classList.add("bg-blue-600", "hover:bg-blue-700");

    try {
      const filePath = book.file || book.path || book.filename;
      if (!filePath) throw new Error("Book entry has no file path");
      listEl.innerHTML = `<div class="text-white">Loading book... (${filePath})</div>`;
      const bookData = await fetchJsonSafe(filePath);
      currentBook = { name: book.name, file: filePath, data: bookData };
      renderTopics(bookData, filePath, book.name);
    } catch (err) {
      console.error(err);
      showError(`Unable to load book: ${err.message || err}`);
      listEl.innerHTML = "";
    }
  }

  function topicsFrom(bookData) {
    return Array.isArray(bookData)
      ? bookData
      : bookData.topics || bookData.items || [];
  }

  function renderTopics(bookData, fileKey, bookName) {
    const topics = topicsFrom(bookData);
    if (!Array.isArray(topics)) {
      showError(
        "Book JSON format not recognized (expected array or {topics:[]})"
      );
      return;
    }

    listEl.innerHTML = "";
    const progress = loadProgress(bookName);

    topics.forEach((t) => {
      const num = t.n || t.id || t.index || "";
      const key = "t" + num;
      const checked = !!progress[key];

      const card = document.createElement("div");
      card.className = "bg-gray-800 p-4 rounded-lg flex items-start gap-4";

      const left = document.createElement("div");
      left.className = "flex-shrink-0 text-center";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = "cb-" + num;
      cb.checked = checked;
      cb.className = "form-checkbox h-5 w-5 text-blue-600";
      cb.setAttribute("aria-label", "Mark lesson completed");
      cb.addEventListener("change", (e) => {
        const p = loadProgress(bookName);
        p[key] = e.target.checked;
        saveProgress(p, bookName);
      });
      const numEl = document.createElement("div");
      numEl.className = "mt-2 text-gray-400 text-sm";
      numEl.textContent = num;
      left.appendChild(cb);
      left.appendChild(numEl);

      const right = document.createElement("div");
      right.className = "flex-1";
      const h = document.createElement("div");
      h.className = "flex items-center justify-between flex-wrap";
      const title = document.createElement("h5");
      title.className = "text-lg font-bold text-white";
      title.textContent = t.title || "Untitled";
      const math = document.createElement("div");
      math.className = "text-sm text-gray-400 ml-3";
      math.textContent = t.math || "";
      h.appendChild(title);
      h.appendChild(math);

      const note = document.createElement("div");
      note.className = "mt-2 text-gray-300 text-sm";
      note.textContent = t.note || "";

      const actions = document.createElement("div");
      actions.className = "mt-3 flex gap-2";

      function openAndCheck(url) {
        try {
          const p = loadProgress(bookName);
          p[key] = true;
          saveProgress(p, bookName);
          const el = document.getElementById("cb-" + num);
          if (el) el.checked = true;
        } catch (e) {
          console.error(e);
        }
        window.open(url, "_blank", "noopener");
      }

      const searchBtn = document.createElement("button");
      searchBtn.className =
        "bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded text-sm";
      searchBtn.innerHTML =
        '<i class="fa-solid fa-magnifying-glass me-2"></i> Searcher';
      searchBtn.title = "Open ChatGPT search with this lesson note";
      searchBtn.addEventListener("click", () =>
        openAndCheck(makeQueryUrl(t.note || "", "search"))
      );

      const studyBtn = document.createElement("button");
      studyBtn.className =
        "bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded text-sm";
      studyBtn.innerHTML =
        '<i class="fa-solid fa-book-open me-2"></i> Study';
      studyBtn.title = "Open ChatGPT study session with this lesson note";
      studyBtn.addEventListener("click", () =>
        openAndCheck(makeQueryUrl(t.note || "", "study"))
      );

      const copyBtn = document.createElement("button");
      copyBtn.className =
        "bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-3 rounded text-sm";
      copyBtn.innerHTML =
        '<i class="fa-regular fa-clipboard me-1"></i>Copy note';
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(t.note || "").then(() => {
          copyBtn.innerHTML =
            '<i class="fa-solid fa-check me-1"></i>Copied';
          setTimeout(() => {
            copyBtn.innerHTML =
              '<i class="fa-regular fa-clipboard me-1"></i>Copy note';
          }, 1200);
        });
      });

      actions.appendChild(searchBtn);
      actions.appendChild(studyBtn);
      actions.appendChild(copyBtn);

      right.appendChild(h);
      right.appendChild(note);
      right.appendChild(actions);

      card.appendChild(left);
      card.appendChild(right);
      listEl.appendChild(card);
    });

    const selectAllBtn = document.getElementById("selectAll");
    const clearAllBtn = document.getElementById("clearAll");

    selectAllBtn.onclick = () => {
      const p = {};
      topicsFrom(bookData).forEach((t) => {
        const id = t.n || t.id || t.index || "";
        if (id) p["t" + id] = true;
      });
      saveProgress(p, bookName);
      renderTopics(bookData, fileKey, bookName);
    };
    clearAllBtn.onclick = () => {
      saveProgress({}, bookName);
      renderTopics(bookData, fileKey, bookName);
    };
  }

  function handleScroll() {
    if (
      document.body.scrollTop > 20 ||
      document.documentElement.scrollTop > 20
    ) {
      scrollTopBtn.style.display = "block";
    } else {
      scrollTopBtn.style.display = "none";
    }
  }

  function scrollToTop() {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }

  (async function init() {
    try {
      clearError();
      booksArea.innerHTML =
        '<div class="spinner-border spinner-border-sm me-2" role="status"></div> Loading books...';
      const idx = await fetchJsonSafe(BOOKS_INDEX);
      booksIndex = Array.isArray(idx) ? idx : idx.books || idx.items || [];
      if (!booksIndex || booksIndex.length === 0) {
        booksArea.innerHTML =
          '<div class="small-muted">No books found on server (empty index).</div>';
        return;
      }
      renderBookButtons();
      searchInput.addEventListener("input", (e) =>
        renderBookButtons(e.target.value)
      );
      window.addEventListener("scroll", handleScroll);
      scrollTopBtn.addEventListener("click", scrollToTop);
    } catch (err) {
      console.error(err);
      showError(`Unable to fetch books index: ${err.message || err}`);
      booksArea.innerHTML =
        '<div class="small-muted">Failed to load books.</div>';
    }
  })();
});
      
