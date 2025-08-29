window.addEventListener("DOMContentLoaded", () => {
  const BOOKS_INDEX = "./books.json";
  const booksArea = document.getElementById("booksArea");
  const listEl = document.getElementById("list");
  const loader = document.getElementById("loader");
  const jsError = document.getElementById("jsErrorPlaceholder");
  const searchBooksInput = document.getElementById("searchBooks");
  const searchTopicsInput = document.getElementById("searchTopics");
  const scrollTopBtn = document.getElementById("scrollTopBtn");
  const bookSelectionView = document.getElementById("book-selection-view");
  const topicView = document.getElementById("topic-view");
  const backToBooksBtn = document.getElementById("backToBooksBtn");
  const bookTitle = document.getElementById("bookTitle");

  let booksIndex = [];
  let currentBook = null;

  function showLoader() {
    loader.classList.remove("hidden");
  }

  function hideLoader() {
    loader.classList.add("hidden");
  }

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

  function getSelectedProvider() {
    const selector = document.querySelector(".provider-btn.bg-purple-500");
    return selector ? selector.dataset.provider : "chatgpt";
  }

  function makeQueryUrl(topic, mode, provider) {
    const title = topic.title || "";
    const math = topic.math || "";
    const note = topic.note || "";


    let query = `You are a teacher and going to teach '${title}'`;
    /* future updates
    if (math) {
      query += ` and you must teach '${math}' alongside it`;
    }
    */
    query += ` . here is a note describing exactly what you have to teach and focus on : "${note}"`;

    const q = encodeURIComponent(query);
    switch (provider) {
      case "perplexity":
        return `https://www.perplexity.ai/search?q=${q}`;
      case "copilot":
        return `https://www.bing.com/search?q=${q}&showconv=1`;
      case "chatgpt":
      default:
        return `https://chatgpt.com/?q=${q}&ref=ext`;
    }
  }

  async function fetchJsonSafe(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok)
      throw new Error(
        `Failed to fetch ${url} — ${res.status} ${res.statusText}`
      );
    return res.json();
  }

  function resetBookButtonStyles() {
    document.querySelectorAll(".book-btn.bg-purple-600").forEach((b) => {
      b.classList.remove("bg-purple-600");
      b.classList.add("bg-gray-800");
    });
  }

  function renderBookButtons(filter = "") {
    booksArea.innerHTML = "";
    booksArea.classList.add("fade-in");
    const fragment = document.createDocumentFragment();
    const filterLower = filter.toLowerCase();

    function renderNode(node, forceShow = false) {
      const isCategory = !!node.children;

      if (isCategory) {
        const categoryName = node.name.toLowerCase();
        const categoryMatches = !filterLower || categoryName.includes(filterLower);
        
        const childElements = node.children
          .map(child => renderNode(child, forceShow || categoryMatches))
          .filter(Boolean);

        if (childElements.length > 0) {
          const categoryEl = document.createElement("div");
          categoryEl.className = "col-span-full mb-4";
          categoryEl.innerHTML = `<h2 class="text-2xl font-bold text-white border-b-2 border-purple-500 pb-2">${node.name}</h2>`;

          const childrenContainer = document.createElement("div");
          childrenContainer.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-4";
          childElements.forEach(el => childrenContainer.appendChild(el));
          
          categoryEl.appendChild(childrenContainer);
          return categoryEl;
        }
      } else { // It's a book
        const bookName = node.name.toLowerCase();
        if (forceShow || !filterLower || bookName.includes(filterLower)) {
          const btn = document.createElement("button");
          btn.className =
            "bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 px-6 rounded-lg shadow-md transition-all duration-300 transform hover:scale-105 book-btn flex flex-col items-center justify-center text-center";
          btn.innerHTML = `<span class="text-lg">${node.name}</span>`;
          btn.dataset.file = node.file || node.filename || node.path || "";
          btn.title = `Load book: ${node.name}`;
          btn.addEventListener("click", () => {
            resetBookButtonStyles();
            btn.classList.remove("bg-gray-800");
            btn.classList.add("bg-purple-600");
            selectBook(node, btn);
          });
          return btn;
        }
      }
      return null;
    }

    booksIndex.forEach(node => {
      const element = renderNode(node);
      if (element) {
        fragment.appendChild(element);
      }
    });

    if (fragment.children.length === 0) {
      booksArea.innerHTML =
        '<div class="text-gray-400 col-span-full text-center">No books or categories found.</div>';
    } else {
      booksArea.appendChild(fragment);
    }
  }

  async function selectBook(book, btnEl) {
    clearError();
    bookSelectionView.style.display = "none";
    topicView.style.display = "block";
    bookTitle.textContent = book.name;
    showLoader();

    try {
      const filePath = book.file || book.path || book.filename;
      if (!filePath) throw new Error("Book entry has no file path");
      listEl.innerHTML = "";
      const bookData = await fetchJsonSafe(filePath);
      currentBook = { name: book.name, file: filePath, data: bookData };
      renderTopics(bookData, filePath, book.name, "");
      searchTopicsInput.value = "";
    } catch (err) {
      console.error(err);
      showError(`Unable to load book: ${err.message || err}`);
      listEl.innerHTML = "";
    } finally {
      hideLoader();
    }
  }

  function topicsFrom(bookData) {
    return Array.isArray(bookData)
      ? bookData
      : bookData.topics || bookData.items || [];
  }

  function renderTopics(bookData, fileKey, bookName, filter = "") {
    let topics = topicsFrom(bookData);
    if (!Array.isArray(topics)) {
      showError(
        "Book JSON format not recognized (expected array or {topics:[]})"
      );
      return;
    }

    if (filter) {
      const lowerFilter = filter.toLowerCase();
      topics = topics.filter(
        (t) =>
          (t.title || "").toLowerCase().includes(lowerFilter) ||
          (t.note || "").toLowerCase().includes(lowerFilter)
      );
    }

    listEl.innerHTML = "";
    listEl.classList.add("fade-in");
    if (topics.length === 0) {
      listEl.innerHTML = `<div class="text-gray-400 col-span-full text-center">No topics found for this filter.</div>`;
      return;
    }

    const progress = loadProgress(bookName);

    topics.forEach((t) => {
      const num = t.n || t.id || t.index || "";
      const key = "t" + num;
      const checked = !!progress[key];

      const card = document.createElement("div");
      card.className = `bg-gray-800 p-5 rounded-xl shadow-lg transition-all duration-300 border border-gray-700 hover:border-purple-500 hover:shadow-purple-500/10 ${
        checked ? "opacity-60" : ""
      }`;

      const header = document.createElement("div");
      header.className = "flex items-center justify-between mb-4";

      const titleGroup = document.createElement("div");
      titleGroup.className = "flex-1";
      const title = document.createElement("h5");
      title.className = "text-xl font-bold text-white leading-tight";
      title.textContent = t.title || "Untitled";
      titleGroup.appendChild(title);

      if (t.math) {
        const math = document.createElement("div");
        math.className =
          "mt-1 text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full inline-block";
        math.textContent = t.math;
        titleGroup.appendChild(math);
      }

      const checkboxGroup = document.createElement("div");
      checkboxGroup.className = "flex items-center gap-2";
      const numEl = document.createElement("div");
      numEl.className = "text-gray-400 font-mono text-sm";
      numEl.textContent = `#${num}`;
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = "cb-" + num;
      cb.checked = checked;
      cb.className =
        "form-checkbox h-6 w-6 text-purple-500 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 cursor-pointer";
      cb.setAttribute("aria-label", "Mark lesson completed");
      cb.addEventListener("change", (e) => {
        const p = loadProgress(bookName);
        p[key] = e.target.checked;
        saveProgress(p, bookName);
        card.classList.toggle("opacity-60", e.target.checked);
      });
      checkboxGroup.appendChild(numEl);
      checkboxGroup.appendChild(cb);

      header.appendChild(titleGroup);
      header.appendChild(checkboxGroup);

      const note = document.createElement("p");
      note.className = "text-gray-400 text-sm mb-5";
      note.textContent = t.note || "";

      const actions = document.createElement("div");
      actions.className = "flex gap-2 flex-wrap";

      function openAndCheck(url) {
        try {
          const p = loadProgress(bookName);
          p[key] = true;
          saveProgress(p, bookName);
          cb.checked = true;
          card.classList.add("opacity-60");
        } catch (e) {
          console.error(e);
        }
        window.open(url, "_blank", "noopener");
      }

      const baseButtonClasses =
        "flex items-center justify-center gap-2 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 text-sm";
      const provider = getSelectedProvider();
      const providerName =
        provider.charAt(0).toUpperCase() + provider.slice(1);

      const searchBtn = document.createElement("button");
      searchBtn.className = `${baseButtonClasses} bg-blue-600 hover:bg-blue-700 flex-1`;
      searchBtn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Search`;
      searchBtn.title = `Open ${providerName} search with this lesson note`;
      searchBtn.addEventListener("click", () =>
        openAndCheck(makeQueryUrl(t, "search", provider))
      );

      const studyBtn = document.createElement("button");
      studyBtn.className = `${baseButtonClasses} bg-gray-700 hover:bg-gray-600 flex-1`;
      studyBtn.innerHTML = `<i class="fa-solid fa-book-open"></i> Study`;
      studyBtn.title = `Open ${providerName} study session with this lesson note`;
      studyBtn.addEventListener("click", () =>
        openAndCheck(makeQueryUrl(t, "study", provider))
      );

      const copyBtn = document.createElement("button");
      copyBtn.className = `${baseButtonClasses} bg-gray-600 hover:bg-gray-500`;
      copyBtn.innerHTML = `<i class="fa-regular fa-clipboard"></i>`;
      copyBtn.title = "Copy note to clipboard";
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(t.note || "").then(() => {
          copyBtn.innerHTML = `<i class="fa-solid fa-check"></i>`;
          copyBtn.title = "Copied!";
          setTimeout(() => {
            copyBtn.innerHTML = `<i class="fa-regular fa-clipboard"></i>`;
            copyBtn.title = "Copy note to clipboard";
          }, 1500);
        });
      });

      actions.appendChild(searchBtn);
      actions.appendChild(studyBtn);
      actions.appendChild(copyBtn);

      card.appendChild(header);
      card.appendChild(note);
      card.appendChild(actions);
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
      renderTopics(bookData, fileKey, bookName, filter);
    };
    clearAllBtn.onclick = () => {
      saveProgress({}, bookName);
      renderTopics(bookData, fileKey, bookName, filter);
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
      showLoader();
      console.log("Fetching books index...");
      const idx = await fetchJsonSafe(BOOKS_INDEX);
      booksIndex = Array.isArray(idx) ? idx : idx.books || idx.items || [];
      if (!booksIndex || booksIndex.length === 0) {
        booksArea.innerHTML =
          '<div class="small-muted">No books found on server (empty index).</div>';
        return;
      }
      renderBookButtons();
      searchBooksInput.addEventListener("input", (e) =>
        renderBookButtons(e.target.value)
      );
      searchTopicsInput.addEventListener("input", (e) => {
        if (currentBook) {
          renderTopics(
            currentBook.data,
            currentBook.file,
            currentBook.name,
            e.target.value
          );
        }
      });
      backToBooksBtn.addEventListener("click", () => {
        bookSelectionView.style.display = "block";
        topicView.style.display = "none";
        listEl.innerHTML = "";
        currentBook = null;
        resetBookButtonStyles();
      });
      document.querySelectorAll(".provider-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".provider-btn").forEach((b) => {
            b.classList.remove("bg-purple-500");
            b.classList.add("bg-gray-700", "hover:bg-gray-600");
          });
          btn.classList.remove("bg-gray-700", "hover:bg-gray-600");
          btn.classList.add("bg-purple-500");

          if (currentBook) {
            renderTopics(
              currentBook.data,
              currentBook.file,
              currentBook.name,
              searchTopicsInput.value
            );
          }
        });
      });

      // Set default provider
      const defaultProvider = document.querySelector(
        '.provider-btn[data-provider="chatgpt"]'
      );
      if (defaultProvider) {
        defaultProvider.classList.remove("bg-gray-700", "hover:bg-gray-600");
        defaultProvider.classList.add("bg-purple-500");
      }
      window.addEventListener("scroll", handleScroll);
      scrollTopBtn.addEventListener("click", scrollToTop);
    } catch (err) {
      console.error(err);
      showError(`Unable to fetch books index: ${err.message || err}`);
      booksArea.innerHTML =
        '<div class="small-muted">Failed to load books.</div>';
    } finally {
      hideLoader();
    }
  })();
});
